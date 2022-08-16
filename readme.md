# Solana Indexer
## User-Side Global Package
### Usecase :
* To create the folder and all the starting code required to create a solgraph based on inputs taken by the code from the user
* To build the solgraph code based on the changes made to the yaml files , build refers to creation of interfaces.ts which mainly helps in strong typing all functions in mapping.ts thus eliminating possibility of errors.

### Files :
*  [index.ts](SolGraphPackage/src/index.ts) : The main file that is used to call the proper functions according to the arguments passed to it
*  [init.ts](SolGraphPackage/src/init.ts) : The file that is used to initialize the solgraph folder while taking inputs from the user. THhe inputs are
   *  Solana network
   *  Solgraph / Indexer name (also used as name of folder created)
   *  Project ID registered in AWS
   *  Program Name
   *  Program ID
   *  Path to IDL
   *  Start Slot Height
*  [generator.ts](SolGraphPackage/src/generator.ts) : The file that is used to generate the solgraph code from the yaml files

## Server-Side Files
### Usecase :
* Create EventRouter which primarily fetches data from dynamoDB and routes it to respective functions which are present in mapping.ts
* Creates interfaces with entities as classes such that they have implementations of load and save so that they can be called when required by mapping.ts

### Files :
* [generatorMain.ts](serverSide/generatorMain.ts) : Reads entities.yaml and indexer.yaml and creates interfaces for events and classes for entities with implementations for save and load. it also creates eventRouter.ts which is the main file that is used to route events to the respective functions.
* [index.txt](serverSide/index.txt) : helper to generatorMain.ts to create the eventRouter's getBlockDetails function
* [loadingFunction.ts](serverSide/loadingFunction.ts) : loads an entity from dynamoDB using the primaryID of the entity , uses aws-sdk's dynamoDB `getItem` function
* [savingFunction.ts](serverSide/savingFunction.ts) : saves an entity to dynamoDB , uses aws-sdk's dynamoDB `putItem` function

## Base Server
### Usecase :
* Has multiple functions hosted in a lambda function accessed through the api gateway
* __createAuthCode__ : 
  * Use : creates an authorization code for a specific username , returns authorization code
  * Request format : ```{"username" : string}```
* __createNewProject__ :
  * Use : creates a new project id using hash of name of project and auth code and initializes the dynamoDB item with no code of any sort , returns the project id
  * Request format : ```{"name" : string , "gh" : string , "desc" : string , "username" : string , "authCode" : string}```
* __createProject__ : 
  * Use : Initializes a new project by following steps
    * check if auth code matches the project
    * parse indexer.yaml and entites.yaml (only indexer.yaml is implemented)
    * create tables of the format `$projid_$entityName`
    * create a docker container that clones the github link provided by the user (partially implemented)
    * update the dynamoDB table of indexers accordingly with the yaml files
  * Request format : ```{"indexerYAML" : string , "entitiesYAML" : string , "projid" : string , "authCode" : string}```
* __updateProject__ :
  * Use : Updates an existing project by following steps 
    * check if auth code matches the project
    * parse the previous indexer.yaml and entities.yaml (only indexer.yaml is implemented)
    * delete all tables of the format `$projid_$oldEntityName`
    * delete docker container with tag equal to `projid` (not implemented)
    * initialize using new yaml files
  * Request format : ```{"newIndexerYAML" : string , "newEntitiesYAML" : string , "authCode" : string}```
* __deleteProject__ :
  * Use : Deletes an existing project by following steps 
    * check if auth code matches the project
    * parse the previous indexer.yaml and entities.yaml (only indexer.yaml is implemented)
    * delete all tables of the format `$projid_$oldEntityName`
    * delete docker container with tag equal to `projid` (not implemented)
    * delete item from indexer table in dynamoDB.
### Files :
* [indexerBase.js](indexerBase.js) : holds the code present in the lambda function that handles all these requests and functions.
## Container Creation
### Usecase : 
* creates a docker container with the required github repo on the system it is running on and runs `npm start` in the repo
* uses express to create a server which takes in a github link and verifies it before creating a docker container
### Files :
* [index.ts](DockerCreation/index.ts) : handles verification of github link, creation of dockerFile and running of the docker container.