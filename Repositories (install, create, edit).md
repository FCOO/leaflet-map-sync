# Node.js, Bower, Git, and GitHub

How to install and use Node (npm), Bower, Git, and GitHub
## Installation


1. Install node.js from [nodejs.org](https://nodejs.org/)
2. Install [bower](http://bower.io/) with `>npm install -g bower`
3. Install Git from [git-scm.com](http://git-scm.com/)
4. Optional: Install [TortoiseGit]( https://tortoisegit.org) - Windows Shell Interface to Git
5. Create account on [github.com](https://github.com) 
6. Optional: Install a [GitHub GUI](http://git-scm.com/downloads/guis) eq. [GitHub for Windows](https://windows.github.com/)
7. Install [SASS](http://sass-lang.com) 
8. Install [JSHint](http://jshint.com) with `>npm install jshint`
9. Install [UglifyJS](https://github.com/mishoo/UglifyJS2) with `>npm install uglify-js -g`
10. Install [cat](https://www.npmjs.com/package/cat)

---

## Create a new repository
Create a new repository in GitHub named *PACKAGENAME* 

---

## Clone a repository
Clone the repository to your locale drive using GitHub for Windows or command prompt

### First time
1.	Run `>bower init` to init bower and update/creaet `bower.json`
2.	If you need SASS packages or other packages under development run `>bower install --save-dev PACKAGENAME` to install packages needed for development (NB: remember to add `--save-dev`
3.	Create/update `README.md` (se below)
4.	Create/update `package.json` (se below)
5.	Run `>bower update` to install/update dependencies (if any) 

### SASS Packages
The following SASS-packages can be used in some packages.:

- [bourbon](http://bourbon.io)  `>bower install --save-dev bourbon`
- [modernizr-mixin](https://github.com/danielguillan/modernizr-mixin): `>bower install --save-dev modernizr-mixin`
- [mathsass](https://github.com/terkel/mathsass): `>bower install --save-dev mathsass`

### README.md
The `README.md` file should have the following sections. (TODO)

1. **Header** `# PACKAGENAME`
2. Short description
3. **Configuration instructions** TODO
4. **Installation instructions** TODO
5. **Operating instructions** TODO
6. **A file manifest** TODO
7. **Copyright and licensing information** TODO
8. **Contact information for the distributor or programmer** TODO
9. **Known bugs** TODO
10. **Troubleshooting** TODO
11. **Credits and acknowledgements** TODO
12. **Changelog** TODO

### package.json 
The `package.json` should have the following elements...TODO

- Documentations at [docs.npmjs.com/files/package.json](https://docs.npmjs.com/files/package.json)
 

#### config for JSHint
    "jshintConfig": {
    	"globals": {
    		"L": false,
    		"$": false,
    		"console": false,
    		"DEBUG": false
    	},
    	"undef": true,
    	"unused": true
    },


#### Repository, bugs and homepage
    "repository": {
    	"type": "git",
    	"url": "https://github.com/*USERNAME*/*PACKAGENAME*.git"
    },  
	"bugs": {
    	"url": "https://github.com/*USERNAME*/*PACKAGENAME*/issues"  	
	},  
	"homepage": "https://github.com/*USERNAME*/*PACKAGENAME*"


---
# Create a new version 

1. Build a new version
2. Commit all new files (if any) to git-repository. Messages = *NEW_VERSION* (e.q. "1.2.3")
3. Create a new version in Bower
4. Push the new version

### 1.Build a new version
    >npm run build
    
### 2. Add to git

### 3.New version in Bower
    >bower version 1.2.3 -m "This is a new version bla bla"
or

	>bower version [<newversion> | major | minor | patch] -m "This is a new version bla bla"


### 4. Push
#### TortoiseGit (Windows/pathfinder) 
select `TortoiseGit->Push` 

![](http://i.imgur.com/IFg6Lw2.png)
    

#### Command mode

    git.exe push --tags --progress  "origin" master:master