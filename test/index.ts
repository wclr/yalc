import * as fs from 'fs-extra'
import { doesNotThrow, throws, deepEqual, ok } from 'assert'
import { join } from 'path'
import {
  addPackages,
  updatePackages,
  publishPackage,
  removePackages,
  yalcGlobal,
  getStorePackagesDir,
  getPackageStoreDir,
  readPackageManifest

} from '../src'

import {
  readInstallationsFile
} from '../src/installations'

import {
  readLockfile
} from '../src/lockfile'


const values = {
  depPackage: 'dep-package',
  depPackageVersion: '1.0.0',
  depPackageSignature: '123136036068ab84b01a6b30d65e4af2',
  depPackage2: 'dep-package2',
  depPackage2Version: '1.0.0',
  storeDir: 'yalc-store',
  project: 'project'
}

const fixtureDir = join(__dirname, 'fixture')
const tmpDir = join(__dirname, 'tmp')

const shortSignatureLength = 8

const storeMainDr = join(tmpDir, values.storeDir)
yalcGlobal.yalcStoreMainDir = storeMainDr

const depPackageDir = join(tmpDir, values.depPackage)
const depPackage2Dir = join(tmpDir, values.depPackage2)
const projectDir = join(tmpDir, values.project)

const publishedPackagePath =
  join(storeMainDr, 'packages', values.depPackage, values.depPackageVersion)

const publishedPackage2Path =
  join(storeMainDr, 'packages', values.depPackage2, values.depPackage2Version)


const checkExists = (path: string) =>
  doesNotThrow(() => fs.accessSync(path), path + ' does not exit')

const checkNotExists = (path: string) =>
  throws(() => fs.accessSync(path), path + ' exits')

describe('Yalc package manager', () => {
  before(() => {
    fs.removeSync(tmpDir)
    fs.copySync(fixtureDir, tmpDir)
  })
  describe('Package publish', () => {

    before((done) => {
      publishPackage({
        workingDir: depPackageDir,
        signature: true
      })
      setTimeout(done, 100)
    })

    it('publishes package to store', () => {
      checkExists(publishedPackagePath)
    })

    it('copies package.json npm includes', () => {
      checkExists(join(publishedPackagePath, 'package.json'))
    })

    it('ignores standard non-code', () => {
      checkNotExists(join(publishedPackagePath, 'LICENCE'))
    })

    it('ignores .gitignore', () => {
      checkNotExists(join(publishedPackagePath, '.gitignore'))
    })

    it('handles "files" manifest entry correctly', () => {
      checkExists(
        join(publishedPackagePath, 'src'))
      checkExists(
        join(publishedPackagePath, 'dist/file.txt'))
      checkNotExists(
        join(publishedPackagePath, 'test'))
    })

    it('handles .npmignore correctly', () => {
      checkNotExists(
        join(publishedPackagePath, 'src', 'file-npm-ignored.txt'))
    })

    it('it creates signature file', () => {
      const sigFileName = join(publishedPackagePath, 'yalc.sig')
      checkExists(sigFileName)
      ok(fs.statSync(sigFileName).size  === 32, 'signature file size')
    })

    it('Adds signature to package.json version', () => {
      const pkg = readPackageManifest(publishedPackagePath)!      
      const versionLength = values.depPackageVersion.length + shortSignatureLength + 1
      ok(pkg.version.length === versionLength)
    })

    it('does not respect .gitignore, if .npmignore presents', () => {

    })
  })

  describe('Package 2 (without `files` in manifest) publish, knit', () => {
    const publishedFilePath =
      join(publishedPackage2Path, 'file.txt')
    
    const originalFilePath = join(depPackage2Dir, 'file.txt')
    before((done) => {
      publishPackage({ workingDir: depPackage2Dir, knit: true })
      setTimeout(done, 100)
    })

    it('publishes package to store', () => {
      checkExists(publishedFilePath)
      checkExists(join(publishedPackage2Path, 'package.json'))
    })

    it('publishes symlinks (knitting)', () => {
      ok(fs.readlinkSync(publishedFilePath) === originalFilePath)      
    })
  })

  describe('Add package', () => {
    before((done) => {
      addPackages([values.depPackage], {
        workingDir: projectDir
      })
      setTimeout(done, 100)
    })
    it('copies package to .yalc folder', () => {
      checkExists(join(projectDir, '.yalc', values.depPackage))
    })
    it('copies remove package to node_modules', () => {
      checkExists(join(projectDir, 'node_modules', values.depPackage))
    })
    it('creates to yalc.lock', () => {
      checkExists(join(projectDir, 'yalc.lock'))
    })
    it('places yalc.lock correct info about file', () => {
      const lockFile = readLockfile({ workingDir: projectDir })
      deepEqual(lockFile.packages, {
        [values.depPackage]: {
          file: true,
          replaced: '1.0.0',
          signature: values.depPackageSignature,
        }
      })
    })
    it('updates package.json', () => {
      const pkg = readPackageManifest(projectDir)!
      deepEqual(pkg.dependencies, {
        [values.depPackage]: 'file:.yalc/' + values.depPackage
      })
    })
    it('create and updates installations file', () => {
      const installtions = readInstallationsFile()
      deepEqual(installtions, {
        [values.depPackage]: [projectDir]
      })
    })
  })

  describe('Update package', () => {
    const innterNodeModulesFile =
      join(projectDir, 'node_modules', values.depPackage, 'node_modules/file.txt')
    before((done) => {
      fs.ensureFileSync(innterNodeModulesFile)
      updatePackages([values.depPackage], {
        workingDir: projectDir
      })
      setTimeout(done, 100)
    })

    it('does not change yalc.lock', () => {
      const lockFile = readLockfile({ workingDir: projectDir })
      deepEqual(lockFile.packages, {
        [values.depPackage]: {
          file: true,
          replaced: '1.0.0',
          signature: values.depPackageSignature,
        }
      })
    })
    it('does not remove inner node_modules', () => {
      checkExists(innterNodeModulesFile)
    })
  })

  describe('Remove not existing package', () => {
    before((done) => {
      removePackages(['xxxx'], {
        workingDir: projectDir
      })
      setTimeout(done, 100)
    })
    it('does not updates yalc.lock', () => {
      const lockFile = readLockfile({ workingDir: projectDir })
      deepEqual(lockFile.packages, {
        [values.depPackage]: {
          file: true,
          replaced: '1.0.0',
          signature: values.depPackageSignature,
        }
      })
    })
  })

  describe('Reatreat package', () => {
    before((done) => {
      removePackages([values.depPackage], {
        workingDir: projectDir,
        retreat: true
      })
      setTimeout(done, 100)
    })

    it('does not updates yalc.lock', () => {
      const lockFile = readLockfile({ workingDir: projectDir })
      deepEqual(lockFile.packages, {
        [values.depPackage]: {
          file: true,
          replaced: '1.0.0',
          signature: values.depPackageSignature,
        }
      })
    })

    it('updates package.json', () => {
      const pkg = readPackageManifest(projectDir)!
      deepEqual(pkg.dependencies, {
        [values.depPackage]: values.depPackageVersion
      })
    })

    it('does not update installations file', () => {
      const installtions = readInstallationsFile()
      deepEqual(installtions, {
        [values.depPackage]: [projectDir]
      })
    })

    it('should not remove package from .yalc', () => {
      checkExists(join(projectDir, '.yalc', values.depPackage))
    })

    it('should remove package from node_modules', () => {
      checkNotExists(join(projectDir, 'node_modules', values.depPackage))
    })
  })

  describe('Update (restore after retreat) package', () => {
    before((done) => {
      updatePackages([values.depPackage], {
        workingDir: projectDir
      })
      setTimeout(done, 100)
    })

    it('updates package.json', () => {
      const pkg = readPackageManifest(projectDir)!
      deepEqual(pkg.dependencies, {
        [values.depPackage]: 'file:.yalc/' + values.depPackage
      })
    })
  })

  describe('Remove package', () => {
    before((done) => {
      removePackages([values.depPackage], {
        workingDir: projectDir
      })
      setTimeout(done, 100)
    })

    it('updates yalc.lock', () => {
      const lockFile = readLockfile({ workingDir: projectDir })
      deepEqual(lockFile.packages, {

      })
    })

    it('updates package.json', () => {
      const pkg = readPackageManifest(projectDir)!
      deepEqual(pkg.dependencies, {
        [values.depPackage]: values.depPackageVersion
      })
    })

    it('updates installations file', () => {
      const installtions = readInstallationsFile()
      deepEqual(installtions, {
      })
    })
    it('should remove package from .yalc', () => {
      checkNotExists(join(projectDir, '.ylc', values.depPackage))
    })

    it('should remove package from node_modules', () => {
      checkNotExists(join(projectDir, 'node_modules', values.depPackage))
    })
  })
})