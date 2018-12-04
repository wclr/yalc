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
  const partialFolderContents: DirectoryContents = {
    'file.md': emptyFile
  }
  const folderContents: DirectoryContents = {
    'file.txt': emptyFile,
    ...partialFolderContents
  }
  const partialSourceDirectoryContents: DirectoryContents = {
    folder2: directoryWithContents({
      nested: directoryWithContents({
        'file.txt': emptyFile
      }),
      'file.txt': emptyFile
    }),
    'package.json': fileWithContent(
      '{ "name": "dep-package", "version": "1.0.0" }'
    )
  }
  const sourceDirectoryContents: DirectoryContents = {
    [fileInRoot]: emptyFile,
    [folderInRoot]: directoryWithContents(folderContents),
    ...partialSourceDirectoryContents
  }
  beforeEach(async () => {
    await fs.remove(sourceDirectory)
    await writeDirectoryContents(sourceDirectoryContents, sourceDirectory)
    await fs.remove(destinationDirectory)
    await mirrorDirectory(destinationDirectory, sourceDirectory)
  })

  it('should copy contents from source into destination', async () => {
    await ensureFileSystemContainsDirectoryContents(
      sourceDirectoryContents,
      destinationDirectory
    )
  })

  describe('when copying changed content from source', () => {
    it('should copy new content', async () => {
      const modifiedSourceDirectoryContent: DirectoryContents = {
        ...sourceDirectoryContents,
        ...{
          [fileInRoot]: fileWithContent('some content'),
          'some-new-file.txt': emptyFile
        }
      }
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

    it('should remove old content', async () => {
      await fs.remove(sourceDirectory)
      await writeDirectoryContents(
        {
          [folderInRoot]: directoryWithContents(partialFolderContents),
          ...partialSourceDirectoryContents
        },
        sourceDirectory
      )
      await mirrorDirectory(destinationDirectory, sourceDirectory)

      await ensureFileSystemContainsDirectoryContents(
        partialSourceDirectoryContents,
        destinationDirectory
      )
    })

    it('should not touch file in destination if unchanged in source', async () => {
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
})
