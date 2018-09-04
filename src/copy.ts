const ignore = require('ignore')
import * as fs from 'fs-extra'
import * as crypto from 'crypto'
import * as klaw from 'klaw'

import { join, relative, dirname } from 'path'
import {
  PackageManifest,
  getStorePackagesDir,
  readPackageManifest,
  writePackageManifest,
  writeSignatureFile
} from '.'

const shortSignatureLength = 8

const npmIncludeDefaults = [
  'package.json'
]

const npmIgnoreDefaults = [
  '.*.swp',
  '._*',
  '.DS_Store',
  '.git',
  '.hg',
  '.npmrc',
  '.lock-wscript',
  '.svn',
  '.wafpickle-*',
  'config.gypi',
  'CVS',
  'npm-debug.log',
  'node_modules'
]

const npmFilesIncludedByDefault = [
  '/CHANGELOG',
  '/README',
  '/CHANGES',
  '/HISTORY',
  '/LICENSE',
  '/LICENCE',
  '/NOTICE',
  '/CHANGELOG.*',
  '/README.*',
  '/CHANGES.*',
  '/HISTORY.*',
  '/LICENSE.*',
  '/LICENCE.*',
  '/NOTICE.*'
]

const getFilesToCopy = (workingDir: string, isIncluded: (path: string, isDir: boolean) => boolean) => {
  const filter = (filePath: string) => {
    const f = relative(workingDir, filePath)
    if (!f) return true
    const isDir = fs.statSync(filePath).isDirectory()    
    return isIncluded(f, isDir)
  }
  return new Promise<string[]>((resolve, reject) => {
    const items: string[] = []
    klaw(workingDir, { filter: filter })
      .on('data', (item) => {
        if (!item.stats.isDirectory()) {
          items.push(relative(workingDir, item.path))
        }
      }).on('end', () => {
        resolve(items)
      }).on('error', reject)
  })
}

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

const getIngoreFilesContent = (workingDir: string, hasFilesEntry: boolean): string => {
  let content: string = ''
  const ignoreFiles = {
    npm: join(workingDir, '.npmignore'),
    yarn: join(workingDir, '.yarnignore'),
    git: join(workingDir, '.gitignore'),
  }
  if (fs.existsSync(ignoreFiles.npm)) {
    content += fs.readFileSync(ignoreFiles.npm, 'utf-8') + '\n'
  }
  if (fs.existsSync(ignoreFiles.yarn)) {
    content += fs.readFileSync(ignoreFiles.yarn, 'utf-8') + '\n'
  }
  if (!content.length && !hasFilesEntry && fs.existsSync(ignoreFiles.git)) {
    content += fs.readFileSync(ignoreFiles.git, 'utf-8')
  }
  return content
}

const getFoldersPatterns = (files: string[]) => {
  return files.reduce<string[]>((res, file) =>
    res.concat(
      file.split('/').filter(_ => _)
        .reduce<string[]>((prev, folder) =>
          prev.concat([prev[prev.length - 1], folder].join('/'))
        , []).map(x => x.slice(1))
    )
    , [])
}

export const copyPackageToStore = async (pkg: PackageManifest, options: {
  workingDir: string,
  signature?: boolean,
  knit?: boolean
}) => {
  const { workingDir } = options

  const ignoreRule = ignore()
    .add(npmIgnoreDefaults)
    .add(npmFilesIncludedByDefault)
    .add(getIngoreFilesContent(workingDir, !!pkg.files))
  
  const ignores = (f: string, isDir: boolean) =>
    ignoreRule.ignores(f) || (isDir && ignoreRule.ignores(f + '/'))

  const includeFoldersRule = ignore().add(getFoldersPatterns(pkg.files || []))
  const explicitIncludeRule = pkg.files ? ignore()
    .add(npmIncludeDefaults)
    .add(pkg.files || []) : null
  const includes = (f: string, isDir: boolean) =>
    explicitIncludeRule ?
      explicitIncludeRule.ignores(f)
      || (isDir && includeFoldersRule.ignores(f))
      : true
  const isIncluded = (f: string, isDir: boolean) =>
    !((ignores(f, isDir)) || !(includes(f, isDir)))
    
  const copyFromDir = options.workingDir
  const locPackageStoreDir = join(getStorePackagesDir(), pkg.name, pkg.version)

  fs.removeSync(locPackageStoreDir)

  const filesToCopy = await getFilesToCopy(workingDir, isIncluded)
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
