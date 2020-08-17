import fs from 'fs-extra'
import path from 'path'
import { getStoreMainDir, values } from '.'
import { readLockfile } from './lockfile'

export type PackageName = string & { __packageName: true }

export type PackageInstallation = {
  name: PackageName
  //version: string
  path: string
  //replaced?: string
  //signature?: string
}

export type InstallationsFile = { [packageName: string]: string[] }

export const readInstallationsFile = (): InstallationsFile => {
  const storeDir = getStoreMainDir()
  const installationFilePath = path.join(storeDir, values.installationsFile)
  let installationsConfig: InstallationsFile

  try {
    fs.accessSync(installationFilePath)
    try {
      installationsConfig = fs.readJsonSync(installationFilePath)
    } catch (e) {
      console.error('Error reading installations file', installationFilePath, e)
      installationsConfig = {}
    }
  } catch (e) {
    installationsConfig = {}
  }

  return installationsConfig
}

export const showInstallations = ({ packages }: { packages: string[] }) => {
  const config = readInstallationsFile()
  ;(Object.keys(config) as PackageName[])
    .filter((packageName) =>
      packages.length ? packages.indexOf(packageName) >= 0 : true
    )
    .map((name: PackageName) => ({ name, locations: config[name] }))
    .forEach(({ name, locations }) => {
      console.log(`Installations of package ${name}:`)
      locations.forEach((loc) => {
        console.log(`  ${loc}`)
      })
    })
}

export const cleanInstallations = async ({
  packages,
  dry,
}: {
  packages: string[]
  dry: boolean
}) => {
  const config = readInstallationsFile()
  const installsToRemove = (Object.keys(config) as PackageName[])
    .filter((packageName) =>
      packages.length ? packages.indexOf(packageName) >= 0 : true
    )
    .map((name) => ({ name, locations: config[name] }))
    .reduce((list, { name, locations }) => {
      return locations.reduce((list, loc) => {
        const lockfile = readLockfile({ workingDir: loc })
        const lockPackages = Object.keys(lockfile.packages)
        if (lockPackages.indexOf(name) < 0) {
          return list.concat([
            {
              name,
              //version: '',
              path: loc,
            },
          ])
        }
        return list
      }, list)
    }, [] as PackageInstallation[])
  if (installsToRemove.length) {
    console.info(`Installations clean up:`)
    if (!dry) {
      await removeInstallations(installsToRemove)
    } else {
      installsToRemove.forEach((inst) => {
        console.log(`Installation to remove: ${inst.name} in ${inst.path}`)
      })
      console.warn(`Dry run.`)
    }
  }
}

export const saveInstallationsFile = async (
  installationsConfig: InstallationsFile
) => {
  const storeDir = getStoreMainDir()
  const installationFilePath = path.join(storeDir, values.installationsFile)
  const data = JSON.stringify(installationsConfig, null, 2)
  return fs.writeFile(installationFilePath, data)
}

export const addInstallations = async (
  installations: PackageInstallation[]
) => {
  const installationsConfig = readInstallationsFile()
  let updated = false
  installations.forEach((newInstall) => {
    const packageInstallPaths = installationsConfig[newInstall.name] || []
    installationsConfig[newInstall.name] = packageInstallPaths
    const hasInstallation = !!packageInstallPaths.filter(
      (p) => p === newInstall.path
    )[0]
    if (!hasInstallation) {
      updated = true
      packageInstallPaths.push(newInstall!.path)
    }
  })

  if (updated) {
    await saveInstallationsFile(installationsConfig)
  }
}

export const removeInstallations = async (
  installations: PackageInstallation[]
) => {
  const installationsConfig = readInstallationsFile()
  let updated = false
  installations.forEach((install) => {
    const packageInstallPaths = installationsConfig[install.name] || []
    console.log(`Removing installation of ${install.name} in ${install.path}`)
    const index = packageInstallPaths.indexOf(install.path)
    if (index >= 0) {
      packageInstallPaths.splice(index, 1)
      updated = true
    }
    if (!packageInstallPaths.length) {
      delete installationsConfig[install.name]
    }
  })
  if (updated) {
    await saveInstallationsFile(installationsConfig)
  }
}
