import glob from 'glob'
import util from 'util'
import { resolve } from 'path'
import fs from 'fs-extra'
import { getFileHash } from './copy'

const NODE_MAJOR_VERSION = parseInt(
  (<any>process).versions.node.split('.').shift(),
  10
)

if (NODE_MAJOR_VERSION >= 8 && NODE_MAJOR_VERSION < 10) {
  // Symbol.asyncIterator polyfill for Node 8 + 9
  ;(Symbol as any).asyncIterator =
    Symbol.asyncIterator || Symbol('Symbol.asyncIterator')
}

const globP = util.promisify(glob)

const cache: {
  [dir: string]: {
    glob: string[]
    files: {
      [file: string]: { stat: fs.Stats; hash: string }
    }
  }
} = {}

const makeListMap = (list: string[]) => {
  return list.reduce((map, item) => {
    map[item] = true
    return map
  }, {} as { [file: string]: true })
}

const theSameStats = (srcStat: fs.Stats, destStat: fs.Stats) => {
  return (
    srcStat.mtime.getTime() === destStat.mtime.getTime() &&
    srcStat.size === destStat.size
  )
}

export const copyDirSafe = async (
  srcDir: string,
  destDir: string,
  compareContent = true
) => {
  const ignore = '**/node_modules/**'
  const dot = true
  const nodir = false
  const srcList = cache[srcDir]
    ? cache[srcDir].glob
    : await globP('**', { cwd: srcDir, ignore, dot, nodir })
  const destList = await globP('**', { cwd: destDir, ignore, dot, nodir })
  const srcMap = makeListMap(srcList)
  const destMap = makeListMap(destList)

  const newFiles = srcList.filter((file) => !destMap[file])
  const filesToRemove = destList.filter((file) => !srcMap[file])
  const commonFiles = srcList.filter((file) => destMap[file])
  cache[srcDir] = cache[srcDir] || {
    files: {},
    glob: srcList,
  }
  const filesToReplace: string[] = []
  const srcCached = cache[srcDir].files

  const dirsInDest: { [file: string]: boolean } = {}

  for await (const file of commonFiles) {
    srcCached[file] = srcCached[file] || {}
    const srcFilePath = resolve(srcDir, file)
    const destFilePath = resolve(destDir, file)
    const srcFileStat = srcCached[file].stat || (await fs.stat(srcFilePath))
    srcCached[file].stat = srcFileStat
    const destFileStat = await fs.stat(destFilePath)

    const areDirs = srcFileStat.isDirectory() && destFileStat.isDirectory()
    dirsInDest[file] = destFileStat.isDirectory()

    const replacedFileWithDir =
      srcFileStat.isDirectory() && !destFileStat.isDirectory()
    const dirReplacedWithFile =
      !srcFileStat.isDirectory() && destFileStat.isDirectory()
    if (dirReplacedWithFile || replacedFileWithDir) {
      filesToRemove.push(file)
    }

    const compareByHash = async () => {
      const srcHash =
        srcCached[file].hash || (await getFileHash(srcFilePath, ''))
      srcCached[file].hash = srcHash
      const destHash = await getFileHash(destFilePath, '')
      return srcHash === destHash
    }
    if (
      dirReplacedWithFile ||
      (!areDirs &&
        !theSameStats(srcFileStat, destFileStat) &&
        (!compareContent || !(await compareByHash())))
    ) {
      filesToReplace.push(file)
    }
  }

  // console.log('newFiles', newFiles)
  // console.log('filesToRemove', filesToRemove)
  // console.log('filesToReplace', filesToReplace)

  // first remove files
  await Promise.all(
    filesToRemove
      .filter((file) => !dirsInDest[file])
      .map((file) => fs.remove(resolve(destDir, file)))
  )
  // then empty directories
  await Promise.all(
    filesToRemove
      .filter((file) => dirsInDest[file])
      .map((file) => fs.remove(resolve(destDir, file)))
  )

  const newFilesDirs = await Promise.all(
    newFiles.map((file) =>
      fs.stat(resolve(srcDir, file)).then((stat) => stat.isDirectory())
    )
  )

  await Promise.all(
    newFiles
      .filter((file, index) => !newFilesDirs[index])
      .concat(filesToReplace)
      .map((file) => fs.copy(resolve(srcDir, file), resolve(destDir, file)))
  )
}
