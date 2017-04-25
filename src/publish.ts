import { exec, execSync } from 'child_process'
import * as fs from 'fs-extra'
import * as path from 'path'
import { copyWithIgnorePackageToStore } from './copy'
import {
  PackageInstallation, InstallationsFile,
  readInstallationsFile,
  addInstallations,
  removeInstallations,
  PackageName
} from './installations'

import {
  readLockfile,
  addPackageToLockfile,
} from './lockfile'

import {
  values, PackageManifest, execLoudOptions,
  getPackageManager,
  updatePackages
} from '.'

export interface PublishPackageOptions {
  workingDir: string,
  knit?: boolean
  force?: boolean
  push?: boolean,
  pushSafe?: boolean
}

const { join } = path

export const publishPackage = async (options: PublishPackageOptions) => {
  let pkg: PackageManifest
  try {
    pkg = fs.readJsonSync(
      path.join(options.workingDir, 'package.json')) as PackageManifest;
  } catch (e) {
    console.error('Could not read package.json in', options.workingDir)
    return
  }
  const changeDirCmd = 'cd ' + options.workingDir + ' && '
  const scriptRunCmd = !options.force && pkg.scripts
    ? changeDirCmd + getPackageManager() + ' run ' : ''

  if (scriptRunCmd) {
    if (pkg.scripts!.preloc) {
      console.log('Running preloc script: ' + pkg.scripts!.preloc)
      execSync(scriptRunCmd + 'preloc', execLoudOptions)
    } else if (pkg.scripts!.prepublish) {
      console.log('Running prepublish script: ' + pkg.scripts!.prepublish)
      execSync(scriptRunCmd + 'prepublish', execLoudOptions)
    }
  }

  copyWithIgnorePackageToStore(pkg, options)

  if (scriptRunCmd) {
    if (pkg.scripts!.postloc) {
      console.log('Running postloc script: ' + pkg.scripts!.postloc)
      execSync(scriptRunCmd + 'postloc', execLoudOptions)
    } else if (pkg.scripts!.postpublish) {
      console.log('Running pospublish script: ' + pkg.scripts!.postpublish)
      execSync(scriptRunCmd + 'postpublish', execLoudOptions)
    }
  }

  if (options.push || options.pushSafe) {
    const installationsConfig = readInstallationsFile()
    const installationPaths =
      installationsConfig[pkg.name] || []
    installationPaths.forEach((workingDir) => {
      console.log(`Pushing ${pkg.name}@${pkg.version} in ${workingDir}`)
      updatePackages([pkg.name], { workingDir })
    })
  }
  console.log(`${pkg.name}@${pkg.version} published in store.`)
}
