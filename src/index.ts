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
  addPackageToLockfile
} from './lockfile'

const userHome = require('user-home')

const { join } = path

const ensureSymlinkSync = fs.ensureSymlinkSync as typeof fs.symlinkSync

export const myNameIs = 'yalc'
export const myNameIsCapitalized = 'Yalc'

export const values = {
  lockfileName: 'yalc.lock',
  locedPackagesFolder: '.yalc',
  installationsFile: 'installations.json'
}

export interface AddPackagesOptions {
  dev?: boolean,
  link?: boolean,
  yarn?: boolean,
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

export function getStoreMainDir(): string {
  if (process.platform === 'win32' && process.env.LOCALAPPDATA) {
    return join(process.env.LOCALAPPDATA, myNameIsCapitalized, );
  }
  return join(userHome, '.' + myNameIs, 'packages');
}


export function getStorePackagesDir(): string {
  return join(getStoreMainDir(), 'packages');
}

const getPackageStoreDir = (packageName: string, version = '') =>
  path.join(getStorePackagesDir(), packageName, version)

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

const execLoudOptions = { stdio: 'inherit' }

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
    return { name: '' as PackageName, version: '' }
  }
  return { name: (match[1] || '') + match[2] as PackageName, version: match[3] || '' }
}


export const addPackages = (packages: string[], options: AddPackagesOptions) => {
  const packagesStoreDir = getStorePackagesDir()
  const addedInstalls = packages.map((packageName) => {
    const { name, version = '' } = parsePackageName(packageName)
    
    if (!name) {
      console.log('Could not parse package name', packageName)
    }

    if (!fs.existsSync(getPackageStoreDir(name))) {
      console.log(`Could not find package \`${name}\` in store.`)
      return null
    }
    const versionToInstall = version || getLatestPackageVersion(name)

    const storedPackageDir = getPackageStoreDir(name, versionToInstall)
    
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

    if (options.link) {
      ensureSymlinkSync(destLoctedCopyDir, destloctedLinkDir, 'dir')
    } else {
      const localAddress = 'file:' + values.locedPackagesFolder + '/' + pkg.name
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


      if (whereToAdd[pkg.name] !== localAddress) {
        whereToAdd[pkg.name] = localAddress
        localPkg.dependencies = dependencies
        localPkg.devDependencies = devDependencies
        fs.writeJsonSync(localManifestFile, localPkg)
      }
    }
    console.log(`${pkg.name}@${pkg.version} locted ==> ${destloctedLinkDir}`)
    return { name, version, path: options.workingDir }
  }).filter(_ => _) as PackageInstallation[]

  addPackageToLockfile(
    addedInstalls
      .map((i) => ({
        name: i!.name,
        version: i!.version,
        file: !options.link
      })), { workingDir: options.workingDir }
  )

  addInstallations(addedInstalls)

  if (options.yarn) {
    const changeDirCmd = 'cd ' + options.workingDir + ' && '
    execSync(changeDirCmd + 'yarn')
  }

}

export const showInstallations = (options: { workingDir: string }) => {

}

export const updatePackages = (packages: string[], options: UpdatePackagesOptions) => {
  const lockfile = readLockfile({ workingDir: options.workingDir })

  let packagesToUpdate: string[] = []
  let installationsToRemove: PackageInstallation[] = []
  if (packages.length) {
    packages.forEach((packageName) => {
      const { name, version } = parsePackageName(packageName)
      if (lockfile.packages[name]) {
        if (version) {
          lockfile.packages[name].version = version
        }
        packagesToUpdate.push(name)
      } else {
        installationsToRemove.push({ name, version, path: options.workingDir })
        console.log(`Did not find package ${name} in lockfile, ` +
          `please use 'add' command to add it explicitly.`
        )
      }
    })
  } else {
    packagesToUpdate = Object.keys(lockfile.packages)
  }

  const lockPackages = packagesToUpdate
    .map(name => ({
      name: lockfile.packages[name].version
        ? name + '@' + lockfile.packages[name].version : name,
      file: lockfile.packages[name].file
    }))
  const packagesFiles = lockPackages
    .filter(p => p.file).map(p => p.name)
  addPackages(packagesFiles, { workingDir: options.workingDir })

  const packagesLinks = lockPackages
    .filter(p => !p.file).map(p => p.name)
  addPackages(packagesLinks, { workingDir: options.workingDir, link: true })

  removeInstallations(installationsToRemove)
}

export const removePackages = (packages: string[], options: RemovePackagesOptions) => {

}  
