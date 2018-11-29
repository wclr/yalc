import { exec, execSync } from 'child_process'
import * as fs from 'fs-extra'
import * as path from 'path'
import { copyPackageToStore } from './copy'
import {
  PackageInstallation,
  readInstallationsFile,
  removeInstallations
} from './installations'

import {
  values,
  PackageManifest,
  execLoudOptions,
  getPackageManager,
  updatePackages,
  readPackageManifest,
  getStorePackagesDir
} from '.'

export interface PublishPackageOptions {
  workingDir: string
  signature?: boolean
  knit?: boolean
  force?: boolean
  changed?: boolean,
  push?: boolean
  pushSafe?: boolean,
  yarn?: boolean
  files?: boolean
}

const { join } = path

const execute = (cmd: string) => {
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    exec(cmd, (err, stdout, stderr) => {
      err ? reject(err) : resolve({ stdout, stderr })
    })
  })
}

// https://github.com/yarnpkg/yarn/issues/2165
const workaroundYarnCacheBug = async (pkg: PackageManifest) => {
  try {
    const yarnCacheDir = (await execute('yarn cache dir')).stdout
    if (yarnCacheDir) {
      const cachedVersionPath = join(
        yarnCacheDir,
        ['npm', pkg.name, pkg.version].join('-')
      )
      fs.removeSync(cachedVersionPath)
    }
  } catch (e) {}
}

export const publishPackage = async (options: PublishPackageOptions) => {
  const workingDir = options.workingDir
  const pkg = readPackageManifest(workingDir)
  if (!pkg) {
    return
  }

  const changeDirCmd = 'cd ' + options.workingDir + ' && '
  const scriptRunCmd =
    !options.force && pkg.scripts
      ? changeDirCmd + getPackageManager(workingDir) + ' run '
      : ''

  if (scriptRunCmd) {
    if (pkg.scripts!.preyalc) {
      console.log('Running preloc script: ' + pkg.scripts!.preyalc)
      execSync(scriptRunCmd + values.prescript, execLoudOptions)
    } else if (pkg.scripts!.prepublishOnly) {
      console.log(
        'Running prepublishOnly script: ' + pkg.scripts!.prepublishOnly
      )
      execSync(scriptRunCmd + 'prepublishOnly', execLoudOptions)
    } else if (pkg.scripts!.prepublish) {
      console.log('Running prepublish script: ' + pkg.scripts!.prepublish)
      execSync(scriptRunCmd + 'prepublish', execLoudOptions)
    }
  }
  const copyRes = await copyPackageToStore(pkg, options)
  if (options.changed && !copyRes) {
    console.log('Package content has not changed, skipping publishing.')
    return
  }
  if (scriptRunCmd) {
    if (pkg.scripts!.postyalc) {
      console.log('Running postloc script: ' + pkg.scripts!.postyalc)
      execSync(scriptRunCmd + values.postscript, execLoudOptions)
    } else if (pkg.scripts!.postpublish) {
      console.log('Running pospublish script: ' + pkg.scripts!.postpublish)
      execSync(scriptRunCmd + 'postpublish', execLoudOptions)
    }
  }

  if (options.push || options.pushSafe) {
    const installationsConfig = readInstallationsFile()
    const installationPaths = installationsConfig[pkg.name] || []
    const installationsToRemove: PackageInstallation[] = []
    for (const workingDir of installationPaths) {
      console.log(`Pushing ${pkg.name}@${pkg.version} in ${workingDir}`)
      const installationsToRemoveForPkg = await updatePackages([pkg.name], {
        workingDir,
        noInstallationsRemove: true,
        yarn: options.yarn
      })
      installationsToRemove.concat(installationsToRemoveForPkg)
    }
    await removeInstallations(installationsToRemove)
  }  
  //await workaroundYarnCacheBug(pkg)
  const publishedPackageDir = join(getStorePackagesDir(), pkg.name, pkg.version)
  const publishedPkg = readPackageManifest(publishedPackageDir)!
  console.log(
    `${publishedPkg.name}@${publishedPkg.version} published in store.`
  )
}
