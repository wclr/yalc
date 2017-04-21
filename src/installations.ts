import * as fs from 'fs-extra'
import * as path from 'path'
import { getStoreDir, values } from '.'

export type PackageInstallation = ({
  name: string,
  version: string,
  path: string
})

export type InstallationsFile = { [packageName: string]: string[] }

export const readInstallationsFile = (): InstallationsFile => {
  const storeDir = getStoreDir()
  const installationFilePath = path.join(storeDir, values.installationsFile)
  fs.ensureFileSync(installationFilePath)
  let installationsConfig: InstallationsFile
  try {
    installationsConfig = fs.readJsonSync(installationFilePath, 'utf-8')
  } catch (e) {
    console.log('Error reading installations file', installationFilePath, e)
    installationsConfig = {}
  }
  return installationsConfig
}

export const saveInstallationsFile = (installationsConfig: InstallationsFile) => {
  const storeDir = getStoreDir()
  const installationFilePath = path.join(storeDir, values.installationsFile)
  fs.writeJson(installationFilePath, installationsConfig)
}

export const addInstallations = (installations: (PackageInstallation)[]) => {
  const installationsConfig = readInstallationsFile()
  let updated = false
  installations
    .forEach(newInstall => {
      const packageInstallPaths = installationsConfig[newInstall.name] || []
      installationsConfig[newInstall.name] = packageInstallPaths
      const hasInstallation = !!packageInstallPaths
        .filter(p => p === newInstall.path)[0]
      if (!hasInstallation) {
        updated = true
        packageInstallPaths.push(newInstall!.path)
      }
    })

  if (updated) {
    saveInstallationsFile(installationsConfig)
  }
}

export const removeInstallations = (installations: (PackageInstallation)[]) => {
  const installationsConfig = readInstallationsFile()
  let updated = false
  installations
    .forEach(install => {
      const packageInstallPaths = installationsConfig[install.name] || []
      const index = packageInstallPaths.indexOf(install.path)
      if (index >= 0) {
        packageInstallPaths.splice(index, 1)
        updated = true
      }
    })
  if (updated) {
    saveInstallationsFile(installationsConfig)
  }
}
