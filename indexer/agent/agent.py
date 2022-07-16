from flask import Flask, redirect, url_for, request
import time, schedule, requests, json
import telebot
from telethon.sync import TelegramClient
from telethon.tl.types import InputPeerUser, InputPeerChannel
from telethon import TelegramClient, sync, events

token = "5308288932:AAHcvcP-fd4O1DiyTKOS_2X3EEFqCAssmUE"
chatID = '-631265484' # Group Chat ID
message = "Alert 😨 : Main Indexer Down ⬇️ ."

app = Flask(__name__)
hashes = []

def _getFileContents():
    global hashes
    try:
        file = open("hash.txt","r+")
        hashes = file.readlines()
        lines = []
        for hash in hashes:
            lines.append(str(hash).strip())
        hashes = lines
    except FileNotFoundError :
        file = open("hash.txt","w+")
        print("File Created")
    except :
        print("Unknown Error")

def _writeFileContent(hash):
    global hashes
    flag = False
    try:
        _getFileContents()
        file = open("hash.txt","a+")
        file.write(str(hash)+"\n")
        file.close()
        flag = True
    except:
        print("Error")
    return flag

def _sendMessage():
    try :
        url = 'https://api.telegram.org/bot' + token + '/sendMessage?chat_id=' + chatID + '&text=' + message
        print(url)
        requests.get(url)
    except Exception as e:
        print(e)

def _checkUpdateHashExists(hash):
    global hashes
    flag = False
    try:
        _getFileContents()
        file = open("hash.txt","w+")
        for i in hashes:
            if str(i).strip() != str(hash).strip():
                file.write(str(i).strip()+"\n")
            if str(i).strip() == str(hash).strip():
                flag = True
        file.close()
    except:
        print("Error")
    return flag

@app.get("/checkHash")
def check():
    if(request.method == 'GET'):
        hash = request.args.get('hash')
        _hashSent = False
        try:
            _hashSent = _checkUpdateHashExists(hash)
            if not _hashSent:
                _sendMessage()
        except:
            print("Error in check")
        return {"status":_hashSent}
    else:
        return {"error":True}
    
        

@app.post("/addHash")
def add():
    if(request.method == "POST"):
        data = json.loads(request.data)
        _hashUpdated = False
        try:
            if(data["hash"]):
                _hashUpdated = _writeFileContent(data["hash"])
        except:
            print("Error Writing")
        return {"status":_hashUpdated}
    else:
        return {"error":True}

if __name__ == "__main__":
    app.run(debug = True, host='0.0.0.0', port=26668)