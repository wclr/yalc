import { exec, execSync } from 'child_process'
import * as fs from 'fs-extra'
import * as path from 'path'
import { copyWithIgnorePackageToStore } from './copy'
import {
  AddedInstallations, InstallationsConfig,
  readInstallationsFile,
  addInstallations
} from './installations'

const userHome = require('user-home')

export const myNameIs = 'yaloc'
export const myNameIsCapitalized = 'Yaloc'
export const lockfileName = 'yaloc.lock'

export const values = {
  locedPackagesFolder: '.yaloc',
  installationsFile: 'installations.json'
}

export interface AddPackagesOptions {
  dev?: boolean,
  file?: boolean,
  safe?: boolean
  workingDir: string,
}

export interface UpdatePackagesOptions {
  safe?: boolean,
  workingDir: string,
}

export interface RemovePackagesOptions {
  workingDir: string,
}


export interface PublishPackageOptions {
  workingDir: string,
  knit?: boolean
  force?: boolean
  push?: boolean,
  pushSafe?: boolean
}

export function getStoreDir(): string {
  if (process.platform === 'win32' && process.env.LOCALAPPDATA) {
    return path.join(process.env.LOCALAPPDATA, myNameIsCapitalized);
  }
  return path.join(userHome, '.' + myNameIs);
}

const getPackageStoreDir = (packageName: string, version = '') =>
  path.join(getStoreDir(), packageName, version)

export interface PackageManifest {
  name: string,
  version: string,
  dependencies?: { [name: string]: string },
  devDependencies?: { [name: string]: string },
  scripts?: {
    preinstall?: string,
    install?: string,
    prepublish?: string
    postpublish?: string
    preloc?: string
    postloc?: string
  }
}

const getPackageManager = () =>
  execSync('yarn.lock') ? 'yarn' : 'npm'

export const publishPackage = async (options: PublishPackageOptions) => {
  let pkg: PackageManifest
  try {
    pkg = fs.readJsonSync(
      path.join(options.workingDir, 'package.json')) as PackageManifest;
  } catch (e) {
    console.error('Could not read package.json')
    return
  }
  const scriptRunCmd = !options.force && pkg.scripts
    ? getPackageManager() + ' run ' : ''
  if (scriptRunCmd) {
    if (pkg.scripts!.preloc) {
      execSync(scriptRunCmd + 'preloc')
    } else if (pkg.scripts!.prepublish) {
      execSync(scriptRunCmd + 'prepublish')
    }
  }

  copyWithIgnorePackageToStore(pkg, options.knit)

  if (scriptRunCmd) {
    if (pkg.scripts!.postloc) {
      execSync(scriptRunCmd + 'preloc')
    } else if (pkg.scripts!.postpublish) {
      execSync(scriptRunCmd + 'prepublish')
    }
  }
  if (options.push || options.pushSafe) {
    const installationPaths =
      readInstallationsFile()[pkg.name] || []

    installationPaths.forEach(() => {
      // TO implement
    })
  }
  console.log(`${pkg.name}@${pkg.version} published in store.`)
}

const getLatestPackageVersion = (packageName: string) => {
  const dir = getPackageStoreDir(packageName)
  const versions = fs.readdirSync(dir)
  const latest = versions.map(version => ({
    version, created: fs.statSync(path.join(dir, version)).ctime.getTime()
  }))
    .sort((a, b) => b.created - a.created).map(x => x.version)[0]
  return latest || ''
}

const parsePackageName = (packageName: string) => {
  const match = packageName.match(/(^@[^/]+\/)?([^@]+)@?(.*)/) || []
  if (!match) {
    return { name: '', version: '' }
  }
  return { name: (match[1] || '') + match[2], version: match[3] || '' }
}

export const addPackages = (packages: string[], options: AddPackagesOptions) => {
  const packagesStoreDir = getStoreDir()
  const addedInstalls: AddedInstallations = packages.map((packageName) => {
    let { name, version = '' } = parsePackageName(packageName)
    if (!version) {
      version = getLatestPackageVersion(name)
    }
    if (!name) {
      console.log('Could not parse package name', packageName)
    }
    const storedPackageDir = getPackageStoreDir(name, version)
    if (!fs.existsSync(storedPackageDir)) {
      console.log(`Could not find package \`${packageName}\` ` + storedPackageDir)
      return null
    }

    const pkgFile = path.join(storedPackageDir, 'package.json')
    let pkg
    try {
      pkg = fs.readJsonSync(path.join(storedPackageDir, 'package.json'))
    } catch (e) {
      console.log('Could not read and parse ', pkgFile)
      return null
    }

    const destLoctedCopyDir = path.join(options.workingDir,
      values.locedPackagesFolder, name)
    const destloctedLinkDir = path.join(options.workingDir, 'node_modules', name)

    fs.emptyDirSync(destLoctedCopyDir)
    fs.copySync(storedPackageDir, destLoctedCopyDir)
    fs.removeSync(destloctedLinkDir)
    if (options.file) {
      fs.copySync(destLoctedCopyDir, destloctedLinkDir)
      const localManifestFile = path.join(options.workingDir, 'package.json')
      const localPkg = fs.readJsonSync(localManifestFile) as PackageManifest

      const dependencies = localPkg.dependencies || {}
      const devDependencies = localPkg.devDependencies || {}
      let whereToAdd = options.dev
        ? devDependencies : dependencies

      if (options.dev) {
        if (dependencies[pkg.name]) {
          delete dependencies[pkg.name]
        }
      } else {
        if (!dependencies[pkg.name]) {
          if (devDependencies[pkg.name]) {
            whereToAdd = devDependencies
          }
        }
      }

      const localAddress = 'file:' + values.locedPackagesFolder + '/' + pkg.name
      if (whereToAdd[pkg.name] !== localAddress) {
        whereToAdd[pkg.name] = localAddress
        localPkg.dependencies = dependencies
        localPkg.devDependencies = devDependencies
        fs.writeJsonSync(localManifestFile, localPkg)
      }
    } else {
      fs.symlinkSync(destLoctedCopyDir, destloctedLinkDir, 'dir')
    }
    console.log(`${pkg.name}@${pkg.version} locted ==> ${destloctedLinkDir}`)
    return { name, path: destLoctedCopyDir }
  })

  addInstallations(addedInstalls)
}


export const updatePackages = (packages: string[], options: UpdatePackagesOptions) => {


}

export const removePackages = (packages: string[], options: RemovePackagesOptions) => {

}  
