import * as fs from 'fs-extra'
import * as path from 'path'

export async function mirrorDirectory(
  destinationDirectory: string,
  sourceDirectory: string
) {
  const itemsInSourceDirectoryExcludingNodeModulesDir = await getAllItemsInDirectory(
    sourceDirectory,
    isNodeModulesDirectory
  )

  const itemsInDestinationDirectoryExcludingNodeModulesDir = await getAllItemsInDirectory(
    destinationDirectory,
    isNodeModulesDirectory
  )

  const itemDiffResults = await diffItemsInDirectories(
    sourceDirectory,
    itemsInSourceDirectoryExcludingNodeModulesDir,
    destinationDirectory,
    itemsInDestinationDirectoryExcludingNodeModulesDir
  )

  const itemsThatAreNew: string[] = []
  const itemsWithChangedContents: string[] = []
  const itemsWithChangedTypes: string[] = []
  const itemsToRemove: string[] = []
  for (const itemDiffResult of itemDiffResults) {
    switch (itemDiffResult.type) {
      case 'added':
        itemsThatAreNew.push(itemDiffResult.itemRelativePath)
        break
      case 'changed-contents':
        itemsWithChangedContents.push(itemDiffResult.itemRelativePath)
        break
      case 'changed-types':
        itemsWithChangedTypes.push(itemDiffResult.itemRelativePath)
        break
      case 'equal':
        break
      case 'removed':
        itemsToRemove.push(itemDiffResult.itemRelativePath)
        break
    }
  }

  await copyItems(sourceDirectory, destinationDirectory, itemsThatAreNew)

  await copyItems(
    sourceDirectory,
    destinationDirectory,
    itemsWithChangedContents
  )

  await removeItems(
    destinationDirectory,
    itemsWithChangedTypes,
    ensureItemRemoved
  )
  await copyItems(sourceDirectory, destinationDirectory, itemsWithChangedTypes)

  await removeItems(destinationDirectory, itemsToRemove)
}

interface FileSystemItem {
  stats: fs.Stats
  absolutePath: string
}
interface NonDirectoryFileSystemItemDescription {
  stats: fs.Stats
  dirContents: undefined
}
interface DirectoryDescription {
  stats: fs.Stats
  dirContents: DirectoryContents
}
type FileSystemItemDescription =
  | NonDirectoryFileSystemItemDescription
  | DirectoryDescription
interface DirectoryContents {
  [name: string]: FileSystemItemDescription
}

async function getAllItemsInDirectory(
  directoryPath: string,
  ignoreItemFunc: (item: FileSystemItem) => boolean
): Promise<DirectoryContents> {
  if (!fs.existsSync(directoryPath)) {
    return {}
  }

  const rootDirPathStats = await fs.lstat(directoryPath)
  if (!rootDirPathStats.isDirectory()) {
    throw new Error(
      `Cannot get items from given path '${directoryPath}' because it is not a directory`
    )
  }

  const itemRelativePaths: string[] = await fs.readdir(directoryPath)
  const itemStats = await getItemStats(directoryPath, itemRelativePaths)

  return await getDirectoryContents(
    directoryPath,
    itemRelativePaths,
    itemStats,
    ignoreItemFunc
  )
}

async function getItemStats(
  directoryPath: string,
  relativeItemPaths: string[]
): Promise<fs.Stats[]> {
  const statsPromises = relativeItemPaths.map(async itemPath => {
    const itemAbsolutePath = path.resolve(directoryPath, itemPath)
    const itemStat = await fs.lstat(itemAbsolutePath)
    return itemStat
  })

  return await Promise.all(statsPromises)
}

async function getDirectoryContents(
  directoryPath: string,
  relativeItemPaths: string[],
  itemStats: fs.Stats[],
  ignoreItemFunc: (item: FileSystemItem) => boolean
): Promise<DirectoryContents> {
  const contents = relativeItemPaths
    .map((itemRelativePath, index) => {
      return {
        relativePath: itemRelativePath,
        absolutePath: path.resolve(directoryPath, itemRelativePath),
        stats: itemStats[index]
      }
    })
    .filter(item => {
      return !ignoreItemFunc(item)
    })
    .map(async item => {
      const itemDescription = await getFileSystemItemDescription(
        item,
        ignoreItemFunc
      )
      return {
        relativePath: item.relativePath,
        description: itemDescription
      }
    })

  return (await Promise.all(contents)).reduce(
    (contents, item) => {
      return { ...contents, [item.relativePath]: item.description }
    },
    {} as DirectoryContents
  )
}

async function getFileSystemItemDescription(
  item: FileSystemItem,
  ignoreItemFunc: (item: FileSystemItem) => boolean
): Promise<FileSystemItemDescription> {
  if (item.stats.isDirectory()) {
    const subDirItems = await getAllItemsInDirectory(
      item.absolutePath,
      ignoreItemFunc
    )
    return {
      dirContents: subDirItems,
      stats: item.stats
    }
  }
  return {
    dirContents: undefined,
    stats: item.stats
  }
}

const isNodeModulesDirectory = (item: FileSystemItem) =>
  item.stats.isDirectory() &&
  path.parse(item.absolutePath).base === 'node_modules'

type ItemDiffResultType =
  | 'added'
  | 'changed-types'
  | 'changed-contents'
  | 'equal'
  | 'removed'
interface ItemDiffResult {
  itemRelativePath: string
  type: ItemDiffResultType
}

async function diffItemsInDirectories(
  sourceDirectoryPath: string,
  sourceDirectoryContents: DirectoryContents,
  destinationDirectoryPath: string,
  destinationDirectoryContents: DirectoryContents
): Promise<ItemDiffResult[]> {
  const itemDiffsForEachItemInSourceDirectoryPromises = Object.keys(
    sourceDirectoryContents
  ).map(async itemRelativePath => {
    const sourceItemDescription = sourceDirectoryContents[itemRelativePath]
    const destinationItemDescription: FileSystemItemDescription | undefined =
      destinationDirectoryContents[itemRelativePath]

    return await diffItemInDirectory(
      sourceDirectoryPath,
      destinationDirectoryPath,
      itemRelativePath,
      sourceItemDescription,
      destinationItemDescription
    )
  })
  const itemDiffsForItemsInSourceDirectory = (await Promise.all(
    itemDiffsForEachItemInSourceDirectoryPromises
  )).reduce((prev, curr) => prev.concat(curr), [])

  const itemDiffResults: ItemDiffResult[] = itemDiffsForItemsInSourceDirectory

  for (const itemRelativePath in destinationDirectoryContents) {
    const sourceItemDescription: FileSystemItemDescription | undefined =
      sourceDirectoryContents[itemRelativePath]

    if (sourceItemDescription === undefined) {
      itemDiffResults.push({ itemRelativePath, type: 'removed' })
    }
  }

  return itemDiffResults
}

async function diffItemInDirectory(
  sourceDirectoryPath: string,
  destinationDirectoryPath: string,
  itemRelativePath: string,
  sourceItemDescription: FileSystemItemDescription,
  destinationItemDescription: FileSystemItemDescription | undefined
): Promise<ItemDiffResult[]> {
  if (destinationItemDescription === undefined) {
    return [{ itemRelativePath, type: 'added' }]
  }

  const sourceItemAbsolutePath = path.resolve(
    sourceDirectoryPath,
    itemRelativePath
  )
  const destinationItemAbsolutePath = path.resolve(
    destinationDirectoryPath,
    itemRelativePath
  )

  if (
    sourceItemDescription.dirContents !== undefined &&
    destinationItemDescription.dirContents !== undefined
  ) {
    const subDiffResults = await diffItemsInDirectories(
      sourceItemAbsolutePath,
      sourceItemDescription.dirContents,
      destinationItemAbsolutePath,
      destinationItemDescription.dirContents
    )
    const appendCurrentRelativePath = (subItemRelativePath: string) =>
      path.join(itemRelativePath, subItemRelativePath)

    return subDiffResults.map(result => ({
      ...result,
      itemRelativePath: appendCurrentRelativePath(result.itemRelativePath)
    }))
  }

  const sourceItem: FileSystemItem = {
    absolutePath: sourceItemAbsolutePath,
    stats: sourceItemDescription.stats
  }

  const destinationItem: FileSystemItem = {
    absolutePath: destinationItemAbsolutePath,
    stats: destinationItemDescription.stats
  }

  const itemDiffType = await diffItems(sourceItem, destinationItem)
  return [{ itemRelativePath, type: itemDiffType }]
}

async function diffItems(
  itemAtSource: FileSystemItem,
  itemAtDestination: FileSystemItem
): Promise<ItemDiffResultType> {
  if (
    itemAtDestination.stats.isDirectory() &&
    itemAtSource.stats.isDirectory()
  ) {
    return 'equal'
  }

  if (itemAtDestination.stats.isFile() && itemAtSource.stats.isFile()) {
    if (
      itemAtDestination.stats.mtime.getTime() ===
        itemAtSource.stats.mtime.getTime() &&
      itemAtDestination.stats.size === itemAtSource.stats.size
    ) {
      const contentsForItemAtDestination = await fs.readFile(
        itemAtDestination.absolutePath
      )
      const contentsForItemAtSource = await fs.readFile(
        itemAtSource.absolutePath
      )

      if (contentsForItemAtDestination.equals(contentsForItemAtSource)) {
        return 'equal'
      }
    }

    return 'changed-contents'
  }

  return 'changed-types'
}

async function copyItems(
  dirToCopyFrom: string,
  dirToCopyTo: string,
  itemRelativePaths: string[]
): Promise<void> {
  const itemsToCopy = itemRelativePaths.map(async itemRelativePath => {
    const sourceItemPath = path.resolve(dirToCopyFrom, itemRelativePath)
    const destinationItemPath = path.resolve(dirToCopyTo, itemRelativePath)

    try {
      await fs.copy(sourceItemPath, destinationItemPath, {
        preserveTimestamps: true
      })
    } catch (error) {
      console.error(
        `Unable to copy item ${sourceItemPath} to ${destinationItemPath}`
      )
      console.error(error)
    }
  })
  await Promise.all(itemsToCopy)
}

async function removeItems(
  dirToRemoveFrom: string,
  itemsRelativePaths: string[],
  removeItemFunction: (itemAbsolutePath: string) => Promise<void> = removeItem
): Promise<void> {
  const removeItemsPromises = itemsRelativePaths.map(async itemRelativePath => {
    const pathToItem = path.resolve(dirToRemoveFrom, itemRelativePath)
    await removeItemFunction(pathToItem)
  })
  await Promise.all(removeItemsPromises)
}

async function removeItem(itemAbsolutePath: string): Promise<void> {
  try {
    await fs.remove(itemAbsolutePath)
  } catch (error) {
    reportUnableToRemoveItem(itemAbsolutePath, error)
  }
}

async function ensureItemRemoved(itemAbsolutePath: string): Promise<void> {
  try {
    await fs.remove(itemAbsolutePath)
    if (await doesItemStillExist(itemAbsolutePath)) {
      // try once again after 100 ms, this should be rarely needed
      await delay(100)
      await doesItemStillExist(itemAbsolutePath, true /*rejectIfExists*/)
    }
  } catch (error) {
    reportUnableToRemoveItem(itemAbsolutePath, error)
  }
}

function reportUnableToRemoveItem(itemAbsolutePath: string, error: any): void {
  console.error(`Unable to remove item ${itemAbsolutePath}`)
  console.error(error)
}

function delay<T>(msToDelay: number, valueToPassThrough?: T) {
  return new Promise<T>(function(resolve) {
    setTimeout(resolve.bind(null, valueToPassThrough), msToDelay)
  })
}

async function doesItemStillExist(
  itemAbsolutePath: string,
  rejectIfExists: boolean = false
): Promise<boolean> {
  return new Promise((resolve, reject) => {
    fs.access(itemAbsolutePath, err => {
      if (err === null) {
        return rejectIfExists
          ? reject(new Error(`Path exists ${itemAbsolutePath}`))
          : resolve(true)
      }

      if (err.code !== undefined && err.code === 'ENOENT') {
        // No such file or directory, the expected error when the file no longer
        // exists
        return resolve(false)
      }

      if (err.code !== undefined && err.code === 'EPERM') {
        // Operation not permitted, on windows if another process is also
        // accessing a file the file won't be deleted immediately and instead
        // will be put into a 'PENDING DELETE' state. This will result in the
        // file 'existing' but permission errors occurring when trying to access
        // it
        return rejectIfExists
          ? reject(
              new Error(
                `Path exists ${itemAbsolutePath} but received ${
                  err.code
                } when accessing it. ` +
                  `If a remove call has just been made this likely means the item is in a 'PENDING DELETE' state due to another process still accessing it.`
              )
            )
          : resolve(true)
      }

      // An unexpected error occurred
      reject(err)
    })
  })
}
