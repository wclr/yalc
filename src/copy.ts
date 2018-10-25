import * as fs from 'fs-extra'
import * as crypto from 'crypto'
import * as npmPacklist from 'npm-packlist';

import { join, dirname } from 'path'
import {
  PackageManifest,
  getStorePackagesDir,
  readPackageManifest,
  writePackageManifest,
  writeSignatureFile
} from '.'

const shortSignatureLength = 8

const ensureDir = (dirPath: string) => new Promise((resolve, reject) =>
  fs.ensureDir(dirPath, (err) => err ? reject(err) : resolve())
)

const copyFile = (srcPath: string, destPath: string, relPath: string) => {
  return new Promise(async (resolve, reject) => {
    await ensureDir(dirname(destPath))
    const stream = fs.createReadStream(srcPath)
    const md5sum = crypto.createHash("md5")
    md5sum.update(relPath.replace(/\\/g, '/'))
    stream.on('data', (data: string) =>
      md5sum.update(data)
    )
    stream
      .pipe(fs.createWriteStream(destPath))
      .on('error', reject)
      .on('close', () => {
        resolve(md5sum.digest('hex'))
      })
  })
}


export const copyPackageToStore = async (pkg: PackageManifest, options: {
  workingDir: string,
  signature?: boolean,
  knit?: boolean
}) => {
  const { workingDir } = options

  const copyFromDir = options.workingDir
  const locPackageStoreDir = join(getStorePackagesDir(), pkg.name, pkg.version)

  fs.removeSync(locPackageStoreDir)

  const filesToCopy = await npmPacklist({ path: workingDir });
  const hashes = await Promise.all(filesToCopy.sort().map((relPath) =>
    copyFile(join(copyFromDir, relPath), join(locPackageStoreDir, relPath), relPath)
  ))
  const signature = crypto.createHash('md5')
    .update(hashes.join('')).digest('hex')
  const shortSignature = signature.substr(0, shortSignatureLength)

  if (options.knit) {
    fs.removeSync(locPackageStoreDir)
    const ensureSymlinkSync = fs.ensureSymlinkSync as any
    filesToCopy.forEach(f => {
      const source = join(copyFromDir, f)
      if (fs.statSync(source).isDirectory()) {
        return
      }
      ensureSymlinkSync(
        source,
        join(locPackageStoreDir, f)
      )
    })
  }
  writeSignatureFile(locPackageStoreDir, signature)
  if (options.signature && !options.knit) {
    const pkg = readPackageManifest(locPackageStoreDir)
    if (pkg) {
      pkg.version = [pkg.version, shortSignature].join('-')
      writePackageManifest(locPackageStoreDir, pkg)
    }
  }
  return signature
}
