import fs from 'fs-extra'
import crypto from 'crypto'
import npmPacklist from 'npm-packlist'
import ignore from 'ignore'

import { join, dirname } from 'path'
import { readIgnoreFile, readSignatureFile, readPackageManifest } from '.'
import {
  PackageManifest,
  getStorePackagesDir,
  writePackageManifest,
  writeSignatureFile,
} from '.'

const shortSignatureLength = 8

export const getFileHash = (srcPath: string, relPath: string = '') => {
  return new Promise<string>(async (resolve, reject) => {
    const stream = fs.createReadStream(srcPath)
    const md5sum = crypto.createHash('md5')
    md5sum.update(relPath.replace(/\\/g, '/'))
    stream.on('data', (data: string) => md5sum.update(data))
    stream.on('error', reject).on('close', () => {
      resolve(md5sum.digest('hex'))
    })
  })
}

const copyFile = async (
  srcPath: string,
  destPath: string,
  relPath: string = ''
) => {
  await fs.copy(srcPath, destPath)
  return getFileHash(srcPath, relPath)
}

const modPackageDev = (
  pkg: PackageManifest,
  options: {
    workingDir: string
  }
) => {
  let newDependencies: undefined | Record<string, string>

  if (pkg.dependencies && Object.keys(pkg.dependencies).length > 0) {
    newDependencies = {}
    const workspaceRegex = /^workspace:/

    for (const [name, version] of Object.entries(pkg.dependencies)) {
      if (!workspaceRegex.test(version)) {
        newDependencies[name] = version
        continue
      }

      const versionWithoutProtocol = version.replace(workspaceRegex, '')
      let newVersion: string = versionWithoutProtocol

      if (versionWithoutProtocol === '*') {
        try {
          // Find dependency root directory. `require.resolve(<dependency>)`
          // finds the entry point of the package, which may be nested
          // `<root>/dist/index.js`. Resolve dependency/package.json instead.
          const dependencyPkgPath = require.resolve(
            join(name, 'package.json'),
            { paths: [options.workingDir] }
          )
          const dependencyVersion = readPackageManifest(
            dirname(dependencyPkgPath)
          )?.version

          newVersion = dependencyVersion ?? versionWithoutProtocol
        } catch (_err) {
          // Let '*' if version could not be resolved, it's also valid semver
        }
      }

      newDependencies[name] = newVersion
    }
  }

  return {
    ...pkg,
    scripts: pkg.scripts
      ? {
          ...pkg.scripts,
          prepare: undefined,
          prepublish: undefined,
        }
      : undefined,
    devDependencies: undefined,
    dependencies: newDependencies,
  }
}

export const copyPackageToStore = async (
  pkg: PackageManifest,
  options: {
    workingDir: string
    signature?: boolean
    changed?: boolean
    files?: boolean
    devMod?: boolean
  }
) => {
  const { workingDir, devMod = true } = options

  const copyFromDir = options.workingDir
  const storePackageStoreDir = join(
    getStorePackagesDir(),
    pkg.name,
    pkg.version
  )

  const ignoreFileContent = readIgnoreFile(workingDir)

  const ignoreRule = ignore().add(ignoreFileContent)
  const npmList: string[] = await npmPacklist({ path: workingDir })
  const filesToCopy = npmList.filter((f) => !ignoreRule.ignores(f))
  if (options.files) {
    console.info('Files included in published content:')
    filesToCopy.forEach((f) => {
      console.log(`- ${f}`)
    })
    console.info(`Total ${filesToCopy.length} files.`)
  }
  const copyFilesToStore = async () => {
    await fs.remove(storePackageStoreDir)
    return Promise.all(
      filesToCopy
        .sort()
        .map((relPath) =>
          copyFile(
            join(copyFromDir, relPath),
            join(storePackageStoreDir, relPath),
            relPath
          )
        )
    )
  }
  const hashes = options.changed
    ? await Promise.all(
        filesToCopy
          .sort()
          .map((relPath) => getFileHash(join(copyFromDir, relPath), relPath))
      )
    : await copyFilesToStore()

  const signature = crypto
    .createHash('md5')
    .update(hashes.join(''))
    .digest('hex')

  if (options.changed) {
    const publishedSig = readSignatureFile(storePackageStoreDir)
    if (signature === publishedSig) {
      return false
    } else {
      await copyFilesToStore()
    }
  }

  writeSignatureFile(storePackageStoreDir, signature)
  const versionPre = options.signature
    ? '+' + signature.substr(0, shortSignatureLength)
    : ''
  const pkgToWrite: PackageManifest = {
    ...(devMod ? modPackageDev(pkg, options) : pkg),
    yalcSig: signature,
    version: pkg.version + versionPre,
  }
  writePackageManifest(storePackageStoreDir, pkgToWrite)
  return signature
}
