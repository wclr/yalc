import * as fs from 'fs-extra'
import * as path from 'path'
import { getStoreMainDir, values } from '.'

export type PackageName = string & { __packageName: true }

export type PackageInstallation = {
  name: PackageName,
  version: string,
  path: string,
  replaced?: string, 
  signature?: string
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
      console.log('Error reading installations file', installationFilePath, e)
      installationsConfig = {}
    }
  } catch (e) {    
    installationsConfig = {}
  }

  return installationsConfig
}

export const saveInstallationsFile = async (installationsConfig: InstallationsFile) => {
  const storeDir = getStoreMainDir()
  const installationFilePath = path.join(storeDir, values.installationsFile)
  const data = JSON.stringify(installationsConfig, null, 2)
  return fs.writeFile(installationFilePath, data)
}

export const addInstallations = async (installations: (PackageInstallation)[]) => {
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
    await saveInstallationsFile(installationsConfig)
  }
}

export const removeInstallations = async (installations: (PackageInstallation)[]) => {
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
      if (!packageInstallPaths.length) {
        delete installationsConfig[install.name]
      }
    })
  if (updated) {
    await saveInstallationsFile(installationsConfig)
  }
}
