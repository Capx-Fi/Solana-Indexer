import express, { Request, Response, NextFunction } from 'express';
var bodyParser = require('body-parser')
var execSync = require('child_process').execSync;

const app = express();
const port = 3000;
app.use(bodyParser.json())

let updates = 0;
let prevrepo : string = "";

async function afterfunction() {

}

app.post('/' , async function (request: Request, response: Response, next: NextFunction) {
  let user : string;
  let repo : string;
  let branch : string = request.body.branch;
  let ghlink : string = (request.body.link);
  if (ghlink.startsWith("https://github.com")) {
    ghlink = ghlink.slice(19);
    if (ghlink.endsWith(".git")) {
      ghlink = ghlink.slice(0,ghlink.length-4);
    }
    if (ghlink.split("/").length == 2) {
      [user , repo] = ghlink.split("/");
    } else if (ghlink.split("/").length >= 4) {
      let split = ghlink.split("/");
      user = split[0];
      repo = split[1];
      branch = split.slice(3).join("/");
    } else {
      response.status(400).send("Invalid GitHub link");
      return;
    }
    console.log(branch)
  } else if (ghlink.startsWith("git@github.com")) {
    ghlink = ghlink.slice(15);
    ghlink = ghlink.slice(0,ghlink.length-4);
    [user , repo] = ghlink.split("/");
  } else {
    response.status(400).send("Invalid GitHub link");
    return;
  }

  if (updates > 0 && prevrepo.length > 0) {
    execSync("cd tests && mv -R "+ prevrepo +" " + prevrepo + "_old");
  }

  try {
    if (branch != undefined) {
      console.log(branch);
      execSync("cd tests && git clone https://github.com/" + user + "/" + repo + " -b " + branch)  
    } else {
      execSync("cd tests && git clone https://github.com/" + user + "/" + repo)
    }
    updates += 1
    prevrepo = repo;

    afterfunction()

    response.status(200).send(
      {
        "status": "success",
      }
    );
  } catch (error : any) {
    if (error.stderr.toString().includes("branch" + branch + " not found")) {
      console.log("Branch not found");
      execSync("cd tests && mv -R "+ prevrepo + "_old" +" " + prevrepo );
      response.status(406).send({error: "Branch not found"});
      return
    } else if (error.stderr.toString().includes(user + "/" + repo + "/' not found")) {
      console.log("Repo doesn't exist or is private");
      response.status(406).send({
        error: "Repo doesn't exist or is private"
      });
      return
    }


  }

  

})

// return json object
// branch wd "/"
// error handling properly
// error code 406
// get prev by ls
app.listen(port, () => {
  console.log(`Application is running on port ${port}.`);
});