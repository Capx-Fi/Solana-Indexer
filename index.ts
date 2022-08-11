import express, { Request, Response, NextFunction } from 'express';
var bodyParser = require('body-parser')
var execSync = require('child_process').execSync;

const app = express();
const port = 3000;
app.use(bodyParser.json())

let updates = 0;
let prevRepos : string[] ;

async function afterFunction() {

}

app.post('/' , async function (request: Request, response: Response, next: NextFunction) {
  let user : string;
  let repo : string;
  let branch : string = request.body.branch;
  let GHLink : string = (request.body.link);
  if (GHLink.startsWith("https://github.com")) {
    GHLink = GHLink.slice(19);
    if (GHLink.endsWith(".git")) {
      GHLink = GHLink.slice(0,GHLink.length-4);
    }
    if (GHLink.split("/").length == 2) {
      [user , repo] = GHLink.split("/");
    } else if (GHLink.split("/").length >= 4) {
      let split = GHLink.split("/");
      user = split[0];
      repo = split[1];
      branch = split.slice(3).join("/");
    } else {
      response.status(406).send({
        error: "Invalid link",
        statusCode : 406
      });
      return;
    }
    console.log(branch)
  } else if (GHLink.startsWith("git@github.com")) {
    GHLink = GHLink.slice(15);
    GHLink = GHLink.slice(0,GHLink.length-4);
    [user , repo] = GHLink.split("/");
  } else {
    response.status(400).send("Invalid GitHub link");
    return;
  }

  console.log(updates,prevRepos,user,repo,branch);
  
  if (prevRepos.indexOf(repo) != -1) {
    execSync("mv "+ repo +" " + repo + "_old");
  }

  try {
    if (branch != undefined) {
      console.log(branch);
      execSync("git clone https://github.com/" + user + "/" + repo + " -b " + branch)  
    } else {
      execSync("git clone https://github.com/" + user + "/" + repo)
    }
    updates += 1
    prevRepos.push(repo);

    afterFunction()

    response.status(200).send(
      {
        "status": "success",
        statusCode : 200
      }
    );
  } catch (error : any) {
    if (error.stderr.toString().includes("branch" + branch + " not found")) {
      console.log("Branch not found");
      if (prevRepos.indexOf(repo) != -1) {
        execSync("mv "+ prevRepos + "_old" +" " + prevRepos );
      }
      response.status(406).send({error: "Branch not found",statusCode : 406});
      return
    } else if (error.stderr.toString().includes(user + "/" + repo + "/' not found")) {
      console.log("Repository not found or Private.");
      if (prevRepos.indexOf(repo) != -1) {
        if (prevRepos.indexOf(repo+"_old") != -1) {
          execSync("rm -rf "+ repo +"_old");
        }
        execSync("mv "+ repo + "_old" +" " + repo );
      }
      response.status(406).send({
        error: "Repository not found or Private.",
        statusCode : 406
      });
      return
    } else {
      console.log("Unknown error");
      if (prevRepos.indexOf(repo) != -1) {
        execSync("mv "+ prevRepos + "_old" +" " + prevRepos );
      }
      response.status(406).send({
        error: "Repository not found or Private.",
        statusCode : 406
      });
      return
    }


  }

  

})


app.listen(port, () => {
  prevRepos = (execSync("ls").toString().split("\n") as string[]).filter(x => x != "");
  console.log(`Application is running on port ${port}.`);
});