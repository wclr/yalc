import * as fs from 'fs-extra'
import { execSync } from 'child_process'
import { dirname, join, relative } from 'path'
import { addInstallations } from './installations'

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
  yarn?: boolean
  pure?: boolean
  noSave?: boolean
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

export const addPackages = async (
  packages: string[],
  options: AddPackagesOptions
) => {
  const workingDir = options.workingDir
  const localPkg = readPackageManifest(workingDir)
  let localPkgUpdated = false
  if (!localPkg) {
    return
  }
  const doPure =
    options.pure !== undefined ? options.pure : !!localPkg.workspaces

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

      const pkg = readPackageManifest(storedPackageDir)
      if (!pkg) {
        return null
      }

      const signature = readSignatureFile(storedPackageDir)
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
      }
      if (!doPure) {
        if (!options.link) {
          const protocol = options.link ? 'link:' : 'file:'
          const localAddress =
            protocol + values.yalcPackagesFolder + '/' + pkg.name

          const dependencies = localPkg.dependencies || {}
          const devDependencies = localPkg.devDependencies || {}

          const whereToRemove = devDependencies[pkg.name]
            ? devDependencies
            : dependencies

          replacedVersion = whereToRemove[pkg.name] || ''
          if (replacedVersion !== localAddress) {
            const whereToAdd =
              options.dev || whereToRemove === devDependencies
                ? devDependencies
                : dependencies

            localPkgUpdated = true
            whereToAdd[pkg.name] = localAddress
            if (whereToAdd !== whereToRemove) {
              delete whereToRemove[pkg.name]
            }
          } else {
            replacedVersion = ''
          }
        }

        const localPackageDir = join(
          workingDir,
          values.yalcPackagesFolder,
          name
        )

        if (signature === readSignatureFile(localPackageDir)) {
          console.log(
            `"${packageName}" already exists in the local ".yalc" directory`
          )
          return null
        }

        // Replace the local ".yalc/{name}" directory.
        fs.removeSync(localPackageDir)
        fs.copySync(storedPackageDir, localPackageDir)

        // Replace the local "node_modules/{name}" symlink.
        const nodeModulesDest = join(workingDir, 'node_modules', name)
        fs.removeSync(nodeModulesDest)
        if (options.link) {
          const target = relative(dirname(nodeModulesDest), nodeModulesDest)
          ensureSymlinkSync(target, nodeModulesDest)
        } else {
          fs.copySync(localPackageDir, nodeModulesDest)
        }

        if (pkg.bin) {
          const binDir = join(workingDir, 'node_modules', '.bin')
          const addBinScript = (src: string, dest: string) => {
            const srcPath = relative(binDir, join(localPackageDir, src))
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

        const addedAction = options.noSave ? 'linked' : 'added'
        console.log(
          `Package ${pkg.name}@${
            pkg.version
          } ${addedAction} ==> ${nodeModulesDest}.`
        )
      }

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
    writePackageManifest(workingDir, localPkg)
  }

  addPackageToLockfile(
    addedInstalls.map(i => ({
      name: i!.name,
      version: i!.version,
      replaced: i!.replaced,
      pure: doPure,
      file: !options.link && !doPure,
      link: options.link && !doPure,
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
