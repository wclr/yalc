import { exec, execSync } from 'child_process'
import * as fs from 'fs-extra'
import * as path from 'path'
import * as os from 'os'
var tar = require('tar-fs')
import * as zlib from 'zlib'
import { PackageManifest, getPackagesStoreDir } from '.'

export const packPackage = (pkg: PackageManifest) => {
  let gitIgnoreMoved = false
  if (fs.existsSync('.npmignore') || fs.existsSync('.yarnignore')) {
    if (fs.existsSync('.gitignore')) {
      fs.renameSync('.gitignore', '._gitignore')
      gitIgnoreMoved = true
    }
  }
  const packedFilePath = path.join(os.tmpdir(), pkg.name.replace('/', '-') + pkg.version)

  // const packedFilePath = path.join(process.cwd(), execSync('npm pack').toString().trim())
  execSync('yarn pack --filename ' + packedFilePath)
  if (gitIgnoreMoved) {
    fs.renameSync('._gitignore', '.gitignore')
  }
  return packedFilePath
}

export const unpackPackage = (tgzFilePath: string, destDir: string) => {
  fs.emptyDirSync(destDir)
  fs.rmdirSync(destDir)
  return new Promise((resolve, reject) => {
    const stream = fs.createReadStream(tgzFilePath)
    stream.pipe(zlib.createGunzip())
      .pipe(tar.extract(destDir, {
        map: (header: any) => {
          header.name = header.name.replace('package/', '')
          return header
        }
      }))
    stream.on('error', reject)
    stream.on('end', resolve)
  })
}

export const packAndPutPackageToStore = async (pkg: PackageManifest) => {
  const packedFilePath = packPackage(pkg)
  const knitPackageDir = path.join(getPackagesStoreDir(), pkg.name, pkg.version)
  await unpackPackage(packedFilePath, knitPackageDir)
  fs.unlinkSync(packedFilePath)
}