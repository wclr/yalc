import fs from 'fs-extra'
import crypto from 'crypto'
import npmPacklist from 'npm-packlist'
import ignore from 'ignore'

import { join } from 'path'
import { readIgnoreFile, readSignatureFile } from '.'
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

export const copyPackageToStore = async (
  pkg: PackageManifest,
  options: {
    workingDir: string
    signature?: boolean
    changed?: boolean
    knit?: boolean
    files?: boolean
  }
) => {
  const { workingDir } = options

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

  if (options.knit) {
    fs.removeSync(storePackageStoreDir)
    const ensureSymlinkSync = fs.ensureSymlinkSync as any
    filesToCopy.forEach((f) => {
      const source = join(copyFromDir, f)
      if (fs.statSync(source).isDirectory()) {
        return
      }
      ensureSymlinkSync(source, join(storePackageStoreDir, f))
    })
  }

  writeSignatureFile(storePackageStoreDir, signature)
  const versionPre =
    options.signature && !options.knit
      ? '+' + signature.substr(0, shortSignatureLength)
      : ''
  const pkgToWrite: PackageManifest = {
    ...pkg,
    version: pkg.version + versionPre,
    devDependencies: undefined,
  }
  writePackageManifest(storePackageStoreDir, pkgToWrite)
  return signature
}
