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
  readPackage,
  writePackage,
  readSignatureFile,
  findPackage
} from '.'

const ensureSymlinkSync = fs.ensureSymlinkSync as typeof fs.symlinkSync

export interface AddPackagesOptions {
  dev?: boolean
  link?: boolean
  linkDep?: boolean
  yarn?: boolean
  safe?: boolean
  pure?: boolean
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

const gracefulFs = require('graceful-fs')
gracefulFs.gracefulify(fs)

export const addPackages = async (
  packages: string[],
  options: AddPackagesOptions
) => {
  const workingDir = findPackage(options.workingDir)
  if (!workingDir) return

  const localPkg = readPackage(workingDir)
  if (!localPkg) return

  let localPkgUpdated = false
  const doPure =
    options.pure === false ? false : options.pure || !!localPkg.workspaces

  const addedInstalls = packages
    .map(packageName => {
      const { name, version = '' } = parsePackageName(packageName)

      if (!name) {
        console.log('Could not parse package name', packageName)
      }

      const storedPackagePath = getPackageStoreDir(name)
      if (!fs.existsSync(storedPackagePath)) {
        console.log(
          `Could not find package \`${name}\` in store (${storedPackagePath}), skipping.`
        )
        return null
      }

      const versionToInstall = version || getLatestPackageVersion(name)
      const storedPackageDir = getPackageStoreDir(name, versionToInstall)
      if (!fs.existsSync(storedPackageDir)) {
        console.log(
          `Could not find package \`${packageName}\` ` + storedPackageDir,
          ', skipping.'
        )
        return null
      }

      const pkg = readPackage(storedPackageDir)
      if (!pkg) {
        return
      }

      const destYalcCopyDir = join(workingDir, values.yalcPackagesFolder, name)
      emptyDirExcludeNodeModules(destYalcCopyDir)
      fs.copySync(storedPackageDir, destYalcCopyDir)

      let replacedVersion = ''
      if (doPure) {
        if (localPkg.workspaces) {
          if (!options.pure) {
            console.log(
              'Because of `workspaces` enabled in this package,' +
                ' --pure option will be used by default, to override use --no-pure.'
            )
          }
        }
        console.log(
          `${pkg.name}@${pkg.version} added to ${join(
            values.yalcPackagesFolder,
            name
          )} purely`
        )
      } else {
        const destModulesDir = join(workingDir, 'node_modules', name)
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
          const localAddress =
            protocol + values.yalcPackagesFolder + '/' + pkg.name

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
            localPkg.dependencies =
              whereToAdd === dependencies ? dependencies : localPkg.dependencies
            localPkg.devDependencies =
              whereToAdd === devDependencies
                ? devDependencies
                : localPkg.devDependencies
            localPkgUpdated = true
          }
          replacedVersion =
            replacedVersion == localAddress ? '' : replacedVersion
        }

        if (pkg.bin) {
          const binDir = join(workingDir, 'node_modules', '.bin')
          const addBinScript = (src: string, dest: string) => {
            const srcPath = join(destYalcCopyDir, src)
            const destPath = join(binDir, dest)
            ensureSymlinkSync(srcPath, destPath)
            fs.chmodSync(destPath, 700)
          }
          if (typeof pkg.bin === 'string') {
            fs.ensureDirSync(binDir)
            addBinScript(pkg.bin, pkg.name)
          } else if (typeof pkg.bin === 'object') {
            fs.ensureDirSync(binDir)
            for (const name in pkg.bin) {
              addBinScript(name, pkg.bin[name])
            }
          }
        }

        const addedAction = options.link ? 'linked' : 'added'
        console.log(
          `Package ${pkg.name}@${
            pkg.version
          } ${addedAction} ==> ${destModulesDir}.`
        )
      }

      const signature = readSignatureFile(storedPackageDir)
      return {
        signature,
        name,
        version,
        replaced: replacedVersion,
        path: options.workingDir
      }
    })
    .filter(_ => !!_)
    .map(_ => _!)

  if (localPkgUpdated) {
    writePackage(workingDir, localPkg)
  }

  addPackageToLockfile(
    addedInstalls.map(i => ({
      name: i!.name,
      version: i!.version,
      replaced: i!.replaced,
      pure: doPure,
      file: !options.link && !options.linkDep && !doPure,
      link: options.linkDep && !doPure,
      signature: i.signature
    })),
    { workingDir: options.workingDir }
  )

  await addInstallations(addedInstalls)

  if (options.yarn) {
    console.log('Running yarn:')
    execSync('yarn', { cwd: options.workingDir })
  }
}
