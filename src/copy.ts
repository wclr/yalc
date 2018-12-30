import * as fs from 'fs-extra'
import * as crypto from 'crypto'
//import * as npmPacklist from 'npm-packlist'
const npmPacklist = require('npm-packlist-fixed')
import ignore from 'ignore'

import { join, dirname } from 'path'
import { readIgnoreFile, readSignatureFile } from '.'
import {
  PackageManifest,
  getStorePackagesDir,
  writePackage,
  writeSignatureFile
} from '.'

const shortSignatureLength = 8

const ensureDir = (dirPath: string) =>
  new Promise((resolve, reject) =>
    fs.ensureDir(dirPath, err => (err ? reject(err) : resolve()))
  )

const getFileHash = (srcPath: string, relPath: string) => {
  return new Promise(async (resolve, reject) => {
    const stream = fs.createReadStream(srcPath)
    const md5sum = crypto.createHash('md5')
    md5sum.update(relPath.replace(/\\/g, '/'))
    stream.on('data', (data: string) => md5sum.update(data))
    stream.on('error', reject).on('close', () => {
      resolve(md5sum.digest('hex'))
    })
  })
}

const copyFile = (srcPath: string, destPath: string, relPath: string) => {
  return new Promise(async (resolve, reject) => {
    await ensureDir(dirname(destPath))
    const stream = fs.createReadStream(srcPath)
    const md5sum = crypto.createHash('md5')
    md5sum.update(relPath.replace(/\\/g, '/'))
    stream.on('data', (data: string) => md5sum.update(data))
    stream
      .pipe(fs.createWriteStream(destPath))
      .on('error', reject)
      .on('close', () => {
        resolve(md5sum.digest('hex'))
      })
  })
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
  const filesToCopy = npmList.filter(f => !ignoreRule.ignores(f))
  if (options.files) {
    console.log('Files included in published content:')
    filesToCopy.forEach(f => {
      console.log(`- ${f}`)
    })
    console.log(`Total ${filesToCopy.length} files.`)
  }
  const copyFilesToStore = async () => {
    await fs.remove(storePackageStoreDir)
    return Promise.all(
      filesToCopy
        .sort()
        .map(relPath =>
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
          .map(relPath => getFileHash(join(copyFromDir, relPath), relPath))
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
    filesToCopy.forEach(f => {
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
      ? '-' + signature.substr(0, shortSignatureLength)
      : ''
  const pkgToWrite: PackageManifest = {
    ...pkg,
    version: pkg.version + versionPre,
    devDependencies: undefined
  }
  writePackage(storePackageStoreDir, pkgToWrite)
  return signature
}
