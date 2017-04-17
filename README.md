# YLoc  (WIP)

> Kind of better workflow than **npm | yarn link**.

## Why

Because uisng standard [symlinked packages](https://docs.npmjs.com/cli/link) aproach (`npm/yarn link`) while development often brings to the table nasty problems and constrains concerning dependency resolution, symlinks interoperability between file systems, etc.

## What

- YLoc acts like very simple local repository of NPM packages. 
- When you  you do `yloc publish` in the package directory it grabs only files that should be published to NPM and *puts* them into special global store located for example in  `~/.yloc`. 
- When you do `yloc add my-package` in your `project` it *pulls* package source to `.yloc` in current folder and creates symlink: 
`project/.yloc/my-package ==> project/node_modules/my-package`

  This design allows to have isolated `node_modules` of *locted* `my-package` and do not worry that something happens with the folder and its content when your package manager performs its *"destructive"* routines (like `yarn --force`)

-  Lock?

## Install

![npm (scoped)](https://img.shields.io/npm/v/yloc.svg?maxAge=86400)

```
  npm i yloc -g
```


## Usage 

#### Publish
- Run `yloc publish` in your dependency package `my-package`.
- You want try to `--knit` option.

#### Add
- Run `yloc add my-package` in your dependant project
- You may add particular versoin `yloc add my-package@version`. 

#### Remove
 - Run `ylock remove my-package`

#### Update
  - Run `yloc update my-package`, `yloc update`  
  - Use `--safe` flag
  - Running simply `yloc` in the directory will do the same as `yloc update`

#### Other

- Probably want to add `.yloc` folder to `.gitignore`.
- Add to package.json `file:.yloc/my-package`


## Licence

WTF.