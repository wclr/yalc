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
  getStorePackagesDir,
  PackageScripts
} from '.'

export interface PublishPackageOptions {
  workingDir: string
  signature?: boolean
  knit?: boolean
  force?: boolean
  changed?: boolean
  push?: boolean
  pushSafe?: boolean
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
  const scripts = pkg.scripts || ({} as PackageScripts)
  const changeDirCmd = 'cd ' + options.workingDir + ' && '
  const scriptRunCmd =
    !options.force && pkg.scripts
      ? changeDirCmd + getPackageManager(workingDir) + ' run '
      : ''

  if (scriptRunCmd) {
    const scriptNames: (keyof PackageScripts)[] = [
      'preyalc',
      'prepare',
      'prepublishOnly',
      'prepublish'
    ]
    const scriptName = scriptNames.filter(name => !!scripts[name])[0]
    if (scriptName) {
      const scriptCmd = scripts[scriptName]
      console.log(`Running ${scriptName} script: ${scriptCmd}`)
      execSync(scriptRunCmd + scriptCmd, execLoudOptions)
    }
  }
  const copyRes = await copyPackageToStore(pkg, options)
  if (options.changed && !copyRes) {
    console.log('Package content has not changed, skipping publishing.')
    return
  }
  if (scriptRunCmd) {
    const scriptNames: (keyof PackageScripts)[] = ['postyalc', 'postpublish']
    const scriptName = scriptNames.filter(name => !!scripts[name])[0]
    if (scriptName) {
      const scriptCmd = scripts[scriptName]
      console.log(`Running ${scriptName} script: ${scriptCmd}`)
      execSync(scriptRunCmd + scriptCmd, execLoudOptions)
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
