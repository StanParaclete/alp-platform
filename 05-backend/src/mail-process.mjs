import { fork } from 'node:child_process';

export async function startMailProcess(env=process.env,{launch=fork,onFailure=()=>process.kill(process.pid,'SIGTERM'),startupMs=45000,shutdownMs=5000}={}) {
  if(env.ALP_MAIL_IN_API!==undefined&&!['true','false'].includes(env.ALP_MAIL_IN_API))throw new Error('ALP_MAIL_IN_API must be true or false.');
  if(env.ALP_MAIL_IN_API!=='true')return {stop:async()=>{}};
  const child=launch(new URL('./worker.mjs',import.meta.url),[],{env,stdio:['ignore','ignore','ignore','ipc']});
  let stopping=false,ready=false,ended=false,failed=false;
  const fail=()=>{if(ready&&!stopping&&!failed){failed=true;onFailure();}};
  child.on('error',fail);
  child.on('exit',()=>{ended=true;fail();});
  child.on('close',()=>{ended=true;fail();});
  const stop=()=>new Promise(resolve=>{
    stopping=true;
    if(ended)return resolve();
    const done=()=>{clearTimeout(timer);child.off('exit',done);child.off('close',done);resolve();};
    child.once('exit',done);child.once('close',done);
    const timer=setTimeout(()=>{child.kill('SIGKILL');},shutdownMs);
    child.kill('SIGTERM');
  });
  try {
    await new Promise((resolve,reject)=>{
      const finish=error=>{
        clearTimeout(timer);
        child.off('message',message);child.off('exit',exit);child.off('error',errorHandler);
        if(error)reject(error);else {ready=true;resolve();}
      };
      const message=value=>{if(value?.type==='alp-mail-ready')finish();};
      const exit=()=>finish(new Error('ALP mail processor exited before readiness.'));
      const errorHandler=()=>finish(new Error('ALP mail processor could not start.'));
      const timer=setTimeout(()=>finish(new Error('ALP mail processor readiness timed out.')),startupMs);
      child.on('message',message);child.once('exit',exit);child.once('error',errorHandler);
    });
  } catch(error){await stop();throw error;}
  return {stop};
}
