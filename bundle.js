import cp from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import axios from 'axios';
import winston from 'winston';
import { MongoClient } from 'mongodb';
import crypto from 'crypto';

let pathFile = JSON.parse(fs.readFileSync('./libs/path.json','utf8'));

async function startSub(){
    async function sub(){
        return new Promise((res,rej)=>{
            let spath = getPath('subconverter');
            let subProgress = cp.spawn(spath,[],{cwd:path.join(process.cwd(),'/libs/subconverter/'),shell:true});
            subProgress.stderr.on('data',(d)=>{
                let dataAfter = Buffer.from(d).toString('utf8');
                //console.log(dataAfter)
                if(dataAfter.includes('Startup completed. Serving HTTP @ http://0.0.0.0:25500')){
                    res();
                }
            });
        })
    }
    await sub();
}

/*
@param {string} input - The input file path.
@return {string} - The output file path.
*/
function getPath(input){
    try{
        let res = path.join(process.cwd()+"/libs/"+pathFile[input][os.platform()][os.arch()]);
        return res
    }catch (e) {
        throw "Platform unsupported."
    }
}

function checkConfig(input,keys){
    for(let i=0;i<keys.length;i++){
        if(typeof input[keys[i]] === "undefined"){
            Logger.error(`Config Error:Could not find the key "${keys[i]}"`);
            process.exit(1);
        }
    }
}

function randomString() {
    let result = '';
    for (let i = 15; i > 0; --i) result += '0123456789abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * '0123456789abcdefghijklmnopqrstuvwxyz'.length)];
    return result;
}
class Timer{
    constructor() {
        this.now = Date.now();
    }
    get(){
        return Date.now() - this.now
    }
}

async function convertSub(input,target) {
    let nodeList = [];
    for (let i = 0; i < input.length; i++) {
        nodeList.push(input[i].url);
    }
    Logger.info(`Start convert sub of ${nodeList.length} nodes`);
    Logger.info("Convert-sub:Start convert sub.");
    try {
        let config = await axios(`http://127.0.0.1:25500/sub?target=${target}&remove_emoji=false&url=` + encodeURIComponent(nodeList.join('|')));
        return config.data
    } catch (e) {
        Logger.error("Error in convert sub.Unable to convert the sub or output the config." + e);
        process.exit(1);
    }
}

async function clearSconvCache() {
    let files = fs.readdirSync('./libs/subconverter/cache');
    for(let i=0;i<files.length;i++){
        fs.unlinkSync('./libs/subconverter/cache/'+files[i]);
    }
}

var toolbox = {
    startSub,checkConfig,randomString,getPath,Timer,convertSub,clearSconvCache
};

const levels = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
};

const level = () => {
    const env = process.env.NODE_ENV || 'development';
    const isDevelopment = env === 'development';
    return isDevelopment ? 'debug' : 'warn'
};

const colors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    debug: 'white',
};

winston.addColors(colors);

const format = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
    winston.format.colorize({ all: true }),
    winston.format.printf(
        (info) => `[${info.timestamp}][${info.level}]${info.message}`,
    ),
);

const transports = [
    new winston.transports.Console(),
    new winston.transports.File({
        filename: `logs/error-${global.dateStr}.log`,
        level: 'error',
    }),
    new winston.transports.File({ filename: `logs/all-${global.dateStr}.log` }),
];

const Logger$1 = winston.createLogger({
    level: level(),
    levels,
    format,
    transports,
});

global.Logger=Logger$1;

class testTask{
    constructor(link){
        this.link = link;    
        this.hash = md5(link);
        this.profile = `[${this.hash}]
        path=${this.hash}
        target=mixed
        url=${this.link}`;
    }
}

function md5(i){
    let md5 = crypto.createHash('md5');
    return md5.update(i).digest('hex');
}

async function convertList(sublist){
    let subPre = [];
    for(let i=0;i<sublist.length;i++){
        if(sublist[i] !== ''){
            subPre.push(new testTask(sublist[i]));
        }
    }
    let scovStr = "";
    for(let i in subPre){
        scovStr += subPre[i].profile;
        scovStr += '\n';
    }
    fs.writeFileSync('./libs/subconverter/generate.ini',scovStr);
    await Promise.all([genConf()]);
    let final = [];
    for(let i in subPre){
        let path = `./libs/subconverter/${subPre[i].hash}`;
        if(fs.existsSync(path)){
            let file = fs.readFileSync(path,'utf8');
            fs.unlinkSync(path);
            let node = Buffer.from(file,'base64').toString('utf8').split('\n');
            Logger.info("Success fetch "+node.length+" from "+subPre[i].link);
            for(let i in node){
                if(node[i] !== ""){
                    final.push(node[i]);
                }
            }
        }
    }
    return final
}

function genConf(){
    return new Promise(async function start(res,rej){
        let spath = toolbox.getPath('subconverter');
        let sconv = cp.spawn(spath,['-g'],{cwd:path.join(process.cwd(),'/libs/subconverter/')});
        sconv.on('exit',_=>{res();});
        sconv.on('close',_=>{res();});
        sconv.stderr.on('data',async (d) => {
            Buffer.from(d).toString('utf8');
            //console.log(dataAfter)
        });
    })
}

var scov = {
    convertList
};

const mClient = new MongoClient(process.env.PAIMONNODE_DB_URI);
let sublist;
let nodes = [];
//start db and subconverter
let preloadServ = async function(){
    Logger.info("Launching service...");
    //Connect to db
    async function startDB(){
        try{
            await mClient.connect();
            sublist = await mClient.db("paimonnode").collection("sublist");
        }catch(e){
            Logger.error("Cannot connect to the db."+e);
            process.exit(1);
        }
        Logger.info("DB √");
    }
    await startDB();
    try{
        await startSub();//Start subconvert service
    }catch(e){
        Logger.error("Cannot start subconvert service."+e);
        process.exit(1);
    }
    Logger.info("Subconvert √");
};

//fetch nodes
let fetchNodes = async function(){
    Logger.info("Start fetch nodes.");
    //let file = fs.readFileSync('../sublist.txt','utf8').split('\n') 
    let f = await axios("https://github.com/paimonhub/Paimonnode/raw/main/sublist.txt");
    let file = [];
    file = file.concat(f.data.split('\n') );
    //let nodeFromFile = fs.readFileSync('../nodelist.txt','utf-8').split('\n')
    let nff = await axios("https://github.com/paimonhub/Paimonnode/raw/main/nodelist.txt");
    let nodeFromFile = nff.data.split('\n');
    for(let i=0;i<nodeFromFile.length;i++){
        if(nodeFromFile[i] !== ""){
            nodes.push(nodeFromFile[i]);
        }
    } 
    let subs = await sublist.find({"PLEASEIGNORE":1}).toArray();
    for(let i=0;i<subs.length;i++){
        file.push(subs[i].link);
    }
    try{
        let res = await axios('https://github.com/WilliamXor/Mux2sub/raw/main/urllist');
        let sourceLst = res.data.split('\n');
        console.log("flist len:"+sourceLst.length);
        for(let i=0;i<sourceLst.length;i++){
            if(sourceLst[i] !== ""){
                file.push(sourceLst[i]);
            }
        }
        Logger.info("Black ♂ Magic:Got "+file.length+" ");
    }catch(e){
        Logger.warn("Black ♂ Magic faild."+e);
    }
    nodes= nodes.concat(await scov.convertList(file));
};
//output to file in base64
let output = async function(){
    Logger.info("Start output nodes.");
    let output = Buffer.from(nodes.join('\n')).toString('base64');
    fs.writeFileSync('out.txt',output);
    Logger.info("Output √");
    return output
};
async function main(){
    await preloadServ();
    await fetchNodes();
    await output();
    process.exit();
}
main();
