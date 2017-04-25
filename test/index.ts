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
  storeDir: 'yalc-store',
  project: 'project'
}

const fixtureDir = join(__dirname, 'fixture')
const tmpDir = join(__dirname, 'tmp')

const storeMainDr = join(tmpDir, values.storeDir)
yalcGlobal.yalcStoreMainDir = storeMainDr

const depPackageDir = join(tmpDir, values.depPackage)
const projectDir = join(tmpDir, values.project)

const publishedPackagePath =
  join(storeMainDr, 'packages', values.depPackage, values.depPackageVersion)

const checkExists = (path: string) =>
  doesNotThrow(() => fs.accessSync(path))

const checkNotExists = (path: string) =>
  throws(() => fs.accessSync(path))


describe('Yalc package manager', () => {
  before(() => {
    fs.removeSync(tmpDir)
    fs.copySync(fixtureDir, tmpDir)
  })
  describe('Package publish', () => {

    before((done) => {
      publishPackage({ workingDir: depPackageDir })
      setTimeout(done, 100)
    })

    it('publishes package to store', () => {
      checkExists(publishedPackagePath)
    })

    it('handles .npmignore correctly', () => {

    })

    it('handles `files` manifest entry correctly', () => {

    })

    it('.gitignore', () => {

    })
  })

  describe('Add package', () => {
    before((done) => {
      addPackages([values.depPackage], {
        workingDir: projectDir
      })
      setTimeout(done, 100)
    })
    it('copies to .yalc folder', () => {
      checkExists(join(projectDir, '.yalc', values.depPackage))
    })
    it('creates to yalc.lock', () => {
      checkExists(join(projectDir, 'yalc.lock'))
    })
    it('places yalc.lock correct info about file', () => {
      const lockFile = readLockfile({ workingDir: projectDir })
      deepEqual(lockFile.packages, {
        [values.depPackage]: {
          file: true,
          replaced: '1.0.0'
        }
      })
    })
    it('updates package.json', () => {
      const pkg = readPackageManifest({workingDir: projectDir})!
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
    before((done) => {
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
          replaced: '1.0.0'
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
          replaced: '1.0.0'
        }
      })
    })

    it('updates package.json', () => {
      const pkg = readPackageManifest({ workingDir: projectDir })!
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
  })

  describe('Update (restore after retreat) package', () => {
    before((done) => {
      updatePackages([values.depPackage], {
        workingDir: projectDir
      })
      setTimeout(done, 100)
    })

    it('updates package.json', () => {
      const pkg = readPackageManifest({workingDir: projectDir})!
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
      const pkg = readPackageManifest({ workingDir: projectDir })!
      deepEqual(pkg.dependencies, {
        [values.depPackage]: values.depPackageVersion
      })
    })

    it('updates installations file', () => {
      const installtions = readInstallationsFile()
      deepEqual(installtions, {
      })
    })
  })
})