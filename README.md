# Yaloc  (WIP)

> Kind of better workflow than **npm | yarn link**.

## Why

Because uisng standard [symlinked packages](https://docs.npmjs.com/cli/link) aproach (`npm/yarn link`) while development often brings (along with potential goodness) nasty constrains and problems with dependency resolution, symlinks interoperability between file systems, etc.

## What

- `Yaloc` acts like very simple local repository of your shared/in-progress packages. 
- When you  you do `yaloc publish` in the package directory it grabs only files that should be published to NPM and *puts* them into special global store located for example in  `~/.yaloc`. 
- When you do `yaloc add my-package` in your `project` it *pulls* package source to `.yaloc` in current folder and creates symlink: 
`project/.yaloc/my-package ==> project/node_modules/my-package`

  This design allows to have isolated `node_modules` of *locted* `my-package` and do not worry that something happens with the folder and its content when your package manager performs its *"destructive"* routines (like `yarn --force`)

  `Yaloc` may also work without engaging symlinks at all. By using `file:` dependency type in your `package.json`.

-  `Yaloc` creates special `yaloc.lock` file in your project where it fixates all the packages (with versions if needed). It is used to update from `yaloc` store consistently.

## Install

![npm (scoped)](https://img.shields.io/npm/v/yaloc.svg?maxAge=86400)

```
  npm i yaloc -g
```


## Usage 

#### Publish
- Run `yaloc publish` in your dependency package `my-package`.

#### Add
- Run `yaloc add my-package` in your dependant project
- You may add particular versoin `yaloc add my-package@version`. 

#### Remove
 - Run `yalock remove my-package`

#### Update
  - Run `yaloc update my-package`, `yaloc update`  
  - Use `--safe` flag * - NOT IMPLEMENTED
  - Running simply `yaloc` in the directory will do the same as `yaloc update`

#### Other

- Probably want to add `.yaloc` folder to `.gitignore`.
- Add to package.json `file:.yaloc/my-package`

## Advanced usage

#### Publish with push

- `yaloc publish --push`

#### Publish using knitting

- You want try to `--knit` option.

## Licence

WTF.