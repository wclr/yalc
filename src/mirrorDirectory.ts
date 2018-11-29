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

  const { newItems, changedItems } = await findNewAndChangedItems(
    itemsInSourceDirectoryExcludingNodeModulesDir,
    itemsInDestinationDirectoryExcludingNodeModulesDir
  )

  const { removedItems } = await findRemovedItems(
    itemsInSourceDirectoryExcludingNodeModulesDir,
    itemsInDestinationDirectoryExcludingNodeModulesDir
  )

  await copyItems(destinationDirectory, newItems)

  await copyItems(destinationDirectory, changedItems)

  await removeItems(removedItems)
}

interface FileSystemItem {
  absolutePath: string
  relativePath: string
  stats: fs.Stats
}

async function getAllItemsInDirectory(
  rootDir: string,
  ignoreItemFunc: (item: FileSystemItem) => boolean,
  parentRootDir?: string
): Promise<FileSystemItem[]> {
  parentRootDir = parentRootDir || rootDir

  if (!fs.existsSync(rootDir)) {
    return []
  }

  const rootDirPathStats = await fs.stat(rootDir)
  if (!rootDirPathStats.isDirectory()) {
    throw new Error(
      `Cannot get items from given path '${rootDir}' because it is not a directory`
    )
  }

  const allItemAbsolutePaths: string[] = (await fs.readdir(rootDir)).map(
    itemPath => path.resolve(rootDir, itemPath)
  )

  const statsPromises: Promise<fs.Stats>[] = []
  for (let entry of allItemAbsolutePaths) {
    const filePath = path.resolve(rootDir, entry)
    statsPromises.push(fs.stat(filePath))
  }
  const allItemStats: fs.Stats[] = await Promise.all(statsPromises)

  const contents: FileSystemItem[] = []
  for (let i = 0; i < allItemAbsolutePaths.length; i++) {
    const item = {
      absolutePath: allItemAbsolutePaths[i],
      relativePath: path.relative(parentRootDir, allItemAbsolutePaths[i]),
      stats: allItemStats[i]
    }

    if (!ignoreItemFunc(item)) {
      if (item.stats.isDirectory()) {
        const subDirItems = await getAllItemsInDirectory(
          item.absolutePath,
          ignoreItemFunc,
          parentRootDir
        )
        contents.push(...subDirItems)
      } else {
        contents.push(item)
      }
    }
  }

  return contents
}

const isNodeModulesDirectory = (item: FileSystemItem) =>
  item.stats.isDirectory() &&
  path.parse(item.absolutePath).base === 'node_modules'

async function findNewAndChangedItems(
  sourceItems: FileSystemItem[],
  destinationItems: FileSystemItem[]
): Promise<{ newItems: FileSystemItem[]; changedItems: FileSystemItem[] }> {
  const destinationItemsAsMapKeyedOnRelativeItemPath = convertFileSystemItemArrayToMapKeyedOnRelativePath(
    destinationItems
  )

  const newItems: FileSystemItem[] = []
  const changedItems: FileSystemItem[] = []
  for (const itemInSourceDirectory of sourceItems) {
    const itemInDestinationDirectory = destinationItemsAsMapKeyedOnRelativeItemPath.get(
      itemInSourceDirectory.relativePath
    )

    const itemDiffResults = await diffItems(
      itemInSourceDirectory,
      itemInDestinationDirectory
    )

    switch (itemDiffResults) {
      case 'changed':
        changedItems.push(itemInSourceDirectory)
        break
      case 'new':
        newItems.push(itemInSourceDirectory)
        break
      case 'same':
        break
    }
  }

  return { newItems, changedItems }
}

async function findRemovedItems(
  sourceItems: FileSystemItem[],
  destinationItems: FileSystemItem[]
): Promise<{ removedItems: FileSystemItem[] }> {
  const itemsInSourceDirectoryAsMap = convertFileSystemItemArrayToMapKeyedOnRelativePath(
    sourceItems
  )
  const removedItems: FileSystemItem[] = []
  for (const itemInDestinationDir of destinationItems) {
    const itemInSourceDirectory = itemsInSourceDirectoryAsMap.get(
      itemInDestinationDir.relativePath
    )

    if (itemInSourceDirectory === undefined) {
      removedItems.push(itemInDestinationDir)
    }
  }

  return { removedItems }
}

function convertFileSystemItemArrayToMapKeyedOnRelativePath(
  items: FileSystemItem[]
): Map<string, FileSystemItem> {
  return new Map<string, FileSystemItem>(
    items.map<[string, FileSystemItem]>(item => [item.relativePath, item])
  )
}

async function diffItems(
  itemAtSource: FileSystemItem,
  itemAtDestination: FileSystemItem | undefined
): Promise<'changed' | 'new' | 'same'> {
  if (itemAtDestination !== undefined) {
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
        return 'same'
      }
    }

    return 'changed'
  }

  return 'new'
}

async function copyItems(
  dirToCopyTo: string,
  items: FileSystemItem[]
): Promise<void> {
  const itemsToCopy = items.map(item =>
    fs.copy(item.absolutePath, path.resolve(dirToCopyTo, item.relativePath), {
      preserveTimestamps: true
    })
  )
  await Promise.all(itemsToCopy)
}

async function removeItems(items: FileSystemItem[]): Promise<void> {
  const removeItemsPromises = items.map(item => fs.remove(item.absolutePath))
  await Promise.all(removeItemsPromises)
}
