import cp from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import axios from 'axios';

let pathFile = JSON.parse(fs.readFileSync('./libs/path.json','utf8'))

export async function startSub(){
    async function sub(){
        return new Promise((res,rej)=>{
            let spath = getPath('subconverter')
            let subProgress = cp.spawn(spath,[],{cwd:path.join(process.cwd(),'/libs/subconverter/'),shell:true})
            subProgress.stderr.on('data',(d)=>{
                let dataAfter = Buffer.from(d).toString('utf8')
                //console.log(dataAfter)
                if(dataAfter.includes('Startup completed. Serving HTTP @ http://0.0.0.0:25500')){
                    res()
                }
            })
        })
    }
    await sub()
}

/*
@param {string} input - The input file path.
@return {string} - The output file path.
*/
function getPath(input){
    try{
        let res = path.join(process.cwd()+"/libs/"+pathFile[input][os.platform()][os.arch()])
        return res
    }catch (e) {
        throw "Platform unsupported."
    }
}

function checkConfig(input,keys){
    for(let i=0;i<keys.length;i++){
        if(typeof input[keys[i]] === "undefined"){
            Logger.error(`Config Error:Could not find the key "${keys[i]}"`)
            process.exit(1)
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
        nodeList.push(input[i].url)
    }
    Logger.info(`Start convert sub of ${nodeList.length} nodes`)
    Logger.info("Convert-sub:Start convert sub.")
    try {
        let config = await axios(`http://127.0.0.1:25500/sub?target=${target}&remove_emoji=false&url=` + encodeURIComponent(nodeList.join('|')));
        return config.data
    } catch (e) {
        Logger.error("Error in convert sub.Unable to convert the sub or output the config." + e)
        process.exit(1)
    }
}

export async function clearSconvCache() {
    let files = fs.readdirSync('./libs/subconverter/cache')
    for(let i=0;i<files.length;i++){
        fs.unlinkSync('./libs/subconverter/cache/'+files[i])
    }
}

export default {
    startSub,checkConfig,randomString,getPath,Timer,convertSub,clearSconvCache
};