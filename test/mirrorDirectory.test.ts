import * as fs from 'fs-extra'
import { doesNotThrow, deepEqual } from 'assert'
import * as path from 'path'
import { mirrorDirectory } from '../src/mirrorDirectory'

const assertExists = (path: string) =>
  doesNotThrow(() => fs.accessSync(path), path + ' does not exist')

const assertFileContentsMatch = async (
  expectedContents: string,
  path: string
) => {
  assertExists(path)
  const actualContents = await fs.readFile(path, 'utf-8')
  deepEqual(actualContents, expectedContents)
}

const tmpDirectory = path.join(__dirname, 'tmp')

const mirrorDirectoryTmpDir = path.join(
  tmpDirectory,
  'mirror-directory-test-fixtures'
)

interface File {
  _: 'file'
  contents: any
}
interface Directory {
  _: 'directory'
  contents: DirectoryContents
}
interface DirectoryContents {
  [name: string]: File | Directory
}

const fileWithContent = (content: string): File => ({
  _: 'file',
  contents: content
})
const directoryWithContents = (contents: DirectoryContents): Directory => ({
  _: 'directory',
  contents: contents
})
const emptyFile: File = fileWithContent('')

async function writeDirectoryContents(
  contents: DirectoryContents,
  destinationDirectoryPath: string
) {
  await fs.ensureDir(destinationDirectoryPath)
  for (const itemName in contents) {
    const item = contents[itemName]
    const itemDestinationPath = path.join(destinationDirectoryPath, itemName)

    if (item._ === 'file') {
      await fs.writeFile(itemDestinationPath, item.contents)
    } else if (item._ === 'directory') {
      await fs.ensureDir(itemDestinationPath)
      await writeDirectoryContents(item.contents, itemDestinationPath)
    }
  }
}

async function ensureFileSystemContainsDirectoryContents(
  contents: DirectoryContents,
  destinationDirectoryPath: string
): Promise<void> {
  assertExists(destinationDirectoryPath)

  for (const itemName in contents) {
    const item = contents[itemName]
    const itemDestinationPath = path.join(destinationDirectoryPath, itemName)

    if (item._ === 'file') {
      await assertFileContentsMatch(item.contents, itemDestinationPath)
    } else if (item._ === 'directory') {
      await ensureFileSystemContainsDirectoryContents(
        item.contents,
        itemDestinationPath
      )
    }
  }
}

describe('Mirror Directory', () => {
  const sourceDirectory = path.join(mirrorDirectoryTmpDir, 'source')
  const destinationDirectory = path.join(mirrorDirectoryTmpDir, 'destination')

  const fileInRoot = 'file.txt'
  const folderInRoot = 'folder'
  const nestedFileInFolder = 'file.md'
  const sourceDirectoryContents: DirectoryContents = {
    [fileInRoot]: emptyFile,
    'package.json': fileWithContent(
      '{ "name": "dep-package", "version": "1.0.0" }'
    ),
    [folderInRoot]: directoryWithContents({
      [nestedFileInFolder]: emptyFile,
      'file.txt': emptyFile
    }),
    folder2: directoryWithContents({
      nested: directoryWithContents({
        'file.txt': emptyFile
      }),
      'file.txt': emptyFile
    })
  }
  beforeEach(async () => {
    fs.removeSync(sourceDirectory)
    await writeDirectoryContents(sourceDirectoryContents, sourceDirectory)
    fs.removeSync(destinationDirectory)
  })

  it('should copy contents from source into destination', async () => {
    await mirrorDirectory(destinationDirectory, sourceDirectory)
    await ensureFileSystemContainsDirectoryContents(
      sourceDirectoryContents,
      destinationDirectory
    )
  })

  it('should copy new content into destination', async () => {
    await mirrorDirectory(destinationDirectory, sourceDirectory)

    const modifiedSourceDirectoryContent: DirectoryContents = Object.assign(
      {},
      sourceDirectoryContents,
      { [fileInRoot]: fileWithContent('some content') }
    )
    await writeDirectoryContents(
      modifiedSourceDirectoryContent,
      sourceDirectory
    )
    await mirrorDirectory(destinationDirectory, sourceDirectory)

    await ensureFileSystemContainsDirectoryContents(
      modifiedSourceDirectoryContent,
      destinationDirectory
    )
  })

  it('should not touch file in destination if unchanged in source', async () => {
    await mirrorDirectory(destinationDirectory, sourceDirectory)

    const pathToFileInRootInDestination = path.join(
      destinationDirectory,
      fileInRoot
    )
    let fileWatcher: fs.FSWatcher | undefined
    let fileEvents: string[] = []
    fileWatcher = fs.watch(pathToFileInRootInDestination, event => {
      fileEvents.push(event)
    })

    await mirrorDirectory(destinationDirectory, sourceDirectory)

    if (fileWatcher) {
      fileWatcher.close()
    }

    if (fileEvents.length > 0) {
      throw new Error(
        `Expected ${pathToFileInRootInDestination} to not be updated because it is the same but fs events [${fileEvents.toString()}] occurred`
      )
    }
  })
})
