import express, { Request, Response, NextFunction } from 'express';
import * as fs from 'fs';
var bodyParser = require('body-parser')
var execSync = require('child_process').execSync;


const app = express();
const port = 3000;
app.use(bodyParser.json())


app.post('/' , async function (request: Request, response: Response, next: NextFunction) {
  let user : string;
  let repo : string;
  let branch : string = request.body.branch;
  let GHLink : string = (request.body.link);
  let logger = fs.createWriteStream("./DockerFile")
  logger.write("FROM alpine/node\nWORKDIR /home/node/app\nRUN apk update && apk add git\n")
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

  function replaceAll(string : string, search : string, replace : string) {
    return string.split(search).join(replace);
  }

  try {
    if (branch != undefined) {
      console.log(branch);
      logger.write("RUN git clone https://github.com/" + user + "/" + repo + " -b " + branch+"\n")  
    } else {
      logger.write("RUN git clone https://github.com/" + user + "/" + repo + "\n")
    }
    logger.write("WORKDIR /home/node/app/" + repo + "\n")
    logger.write("RUN npm install\n")
    logger.write("CMD [\"npm\", \"start\"]\n")
    // logger.write("EXPOSE 5000\n")



    execSync("docker build -t " + user.toLowerCase() + "/" + repo.toLowerCase() + ":latest .");
    execSync("docker run -d -p 80:5000 " + user.toLowerCase() + "/" + repo.toLowerCase() + ":latest");

    response.status(200).send(
      {
        "status": "success",
        statusCode : 200
      }
    );
  } catch (error : any) {
    if (error.stderr.toString().includes("branch" + branch + " not found")) {
      console.log("Branch not found");
      response.status(406).send({error: "Branch not found",statusCode : 406});
      return
    } else if (error.stderr.toString().includes(user + "/" + repo + "/' not found")) {
      console.log("Repo doesn't exist or is private");
      response.status(406).send({
        error: "Repo doesn't exist or is private",
        statusCode : 406
      });
      return
    } else {
      console.log("Unknown error");
      response.status(406).send({
        error: error.stderr.toString(),
        statusCode : 406
      });
      return
    }


  }

  

})


app.listen(port, () => {
  console.log(`Application is running on port ${port}.`);
});