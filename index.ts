import express, { Request, Response, NextFunction } from 'express';
var bodyParser = require('body-parser')
var execSync = require('child_process').execSync;

const app = express();
const port = 3000;
app.use(bodyParser.json())

let updates = 0;
let prevRepos : string[] ;

async function afterFunction(project: string) {

  await console.log("Check Fire");
  await createCustomDockerFile(project);
  await execSync("cp temp_doc.txt "+project+"/Dockerfile");
  // await execSync("cp temp_comp.txt "+project+"/docker-compose.yml");
  await execSync("cd ./"+project);
  await execSync("docker build -t "+project+" .");
  await execSync("docker run -d --name "+project+" "+project)
}

async function createCustomDockerFile(projectDir: string) {
  // TODO;
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
    await execSync("mv "+ repo +" " + repo + "_old");
  }

  try {
    if (branch != undefined) {
      console.log(branch);
      await execSync("git clone https://github.com/" + user + "/" + repo + " -b " + branch)  
    } else {
      await execSync("git clone https://github.com/" + user + "/" + repo)
    }
    updates += 1
    prevRepos.push(repo);

    await afterFunction(repo)


    await response.status(200).send(
      {
        "status": "success",
        statusCode : 200
      }
    );
  } catch (error : any) {
    if (error.stderr.toString().includes("branch" + branch + " not found")) {
      console.log("Branch not found");
      if (prevRepos.indexOf(repo) != -1) {
        await execSync("mv "+ prevRepos + "_old" +" " + prevRepos );
      }
      response.status(406).send({error: "Branch not found",statusCode : 406});
      return
    } else if (error.stderr.toString().includes(user + "/" + repo + "/' not found")) {
      console.log("Repository not found or Private.");
      if (prevRepos.indexOf(repo) != -1) {
        if (prevRepos.indexOf(repo+"_old") != -1) {
          await execSync("rm -rf "+ repo +"_old");
        }
        await execSync("mv "+ repo + "_old" +" " + repo );
      }
      response.status(406).send({
        error: "Repository not found or Private.",
        statusCode : 406
      });
      return
    } else {
      console.log("Unknown error");
      console.log(error);
      if (prevRepos.indexOf(repo) != -1) {
        await execSync("mv "+ prevRepos + "_old" +" " + prevRepos );
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