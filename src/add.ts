import { execSync } from 'child_process'
import * as fs from 'fs-extra'
import { join } from 'path'
import * as del from 'del'
import { PackageInstallation, addInstallations } from './installations'

import { addPackageToLockfile } from './lockfile'

import {
  getPackageStoreDir,
  values,
  parsePackageName,
  readPackageManifest,
  writePackageManifest,
  readSignatureFile
} from '.'

const ensureSymlinkSync = fs.ensureSymlinkSync as typeof fs.symlinkSync

export interface AddPackagesOptions {
  dev?: boolean
  link?: boolean
  linkDep?: boolean
  yarn?: boolean
  safe?: boolean
  workingDir: string
}

const getLatestPackageVersion = (packageName: string) => {
  const dir = getPackageStoreDir(packageName)
  const versions = fs.readdirSync(dir)
  const latest = versions
    .map(version => ({
      version,
      created: fs.statSync(join(dir, version)).ctime.getTime()
    }))
    .sort((a, b) => b.created - a.created)
    .map(x => x.version)[0]
  return latest || ''
}

const emptyDirExcludeNodeModules = (path: string) => {
  // TODO: maybe use fs.remove + readdir for speed.
  del.sync('**', {
    dot: true,
    cwd: path,
    ignore: '**/node_modules/**'
  })
}

const isSymlink = (path: string) => {
  try {
    return !!fs.readlinkSync(path)
  } catch (e) {
    return false
  }
}

export const addPackages = async (packages: string[], options: AddPackagesOptions) => {
  const workingDir = options.workingDir
  const localPkg = readPackageManifest(workingDir)
  let localPkgUpdated = false
  if (!localPkg) {
    return
  }
  const addedInstalls = packages
    .map(packageName => {
      const { name, version = '' } = parsePackageName(packageName)

      if (!name) {
        console.log('Could not parse package name', packageName)
      }

      const storedPackagePath = getPackageStoreDir(name)
      if (!fs.existsSync(storedPackagePath)) {
        console.log(`Could not find package \`${name}\` in store (${storedPackagePath}), skipping.`)
        return null
      }
      const versionToInstall = version || getLatestPackageVersion(name)

      const storedPackageDir = getPackageStoreDir(name, versionToInstall)

      if (!fs.existsSync(storedPackageDir)) {
        console.log(`Could not find package \`${packageName}\` ` + storedPackageDir, ', skipping.')
        return null
      }

      const pkg = readPackageManifest(storedPackageDir)
      if (!pkg) {
        return
      }
      const destYalcCopyDir = join(workingDir, values.yalcPackagesFolder, name)
      const destModulesDir = join(workingDir, 'node_modules', name)

      emptyDirExcludeNodeModules(destYalcCopyDir)
      fs.copySync(storedPackageDir, destYalcCopyDir)
      var gracefulFs = require('graceful-fs')
      gracefulFs.gracefulify(fs)
      let replacedVersion = ''
      if (options.link || options.linkDep || isSymlink(destModulesDir)) {
        fs.removeSync(destModulesDir)
      }

      if (options.link || options.linkDep) {
        ensureSymlinkSync(destYalcCopyDir, destModulesDir, 'junction')
      } else {
        emptyDirExcludeNodeModules(destModulesDir)
        fs.copySync(destYalcCopyDir, destModulesDir)
      }

      if (!options.link) {
        const protocol = options.linkDep ? 'link:' : 'file:'
        const localAddress = protocol + values.yalcPackagesFolder + '/' + pkg.name

        const dependencies = localPkg.dependencies || {}
        const devDependencies = localPkg.devDependencies || {}
        let whereToAdd = options.dev ? devDependencies : dependencies

        if (options.dev) {
          if (dependencies[pkg.name]) {
            replacedVersion = dependencies[pkg.name]
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
          replacedVersion = replacedVersion || whereToAdd[pkg.name]
          whereToAdd[pkg.name] = localAddress
          localPkg.dependencies = whereToAdd === dependencies ? dependencies : localPkg.dependencies
          localPkg.devDependencies =
            whereToAdd === devDependencies ? devDependencies : localPkg.devDependencies
          localPkgUpdated = true
        }
        replacedVersion = replacedVersion == localAddress ? '' : replacedVersion
      }
      const addedAction = options.link ? 'linked' : 'added'
      console.log(`${pkg.name}@${pkg.version} ${addedAction} ==> ${destModulesDir}`)
      const signature = readSignatureFile(storedPackageDir)
      return {
        signature,
        name,
        version,
        replaced: replacedVersion,
        path: options.workingDir
      }
    })
    .filter(_ => _) as PackageInstallation[]

  if (localPkgUpdated) {
    writePackageManifest(workingDir, localPkg)
  }

  addPackageToLockfile(
    addedInstalls.map(i => ({
      name: i!.name,
      version: i!.version,
      replaced: i!.replaced,
      file: !options.link && !options.linkDep,
      link: options.linkDep,
      signature: i.signature
    })),
    { workingDir: options.workingDir }
  )

  await addInstallations(addedInstalls)

  if (options.yarn) {
    const changeDirCmd = 'cd ' + options.workingDir + ' && '
    execSync(changeDirCmd + 'yarn')
  }
}
