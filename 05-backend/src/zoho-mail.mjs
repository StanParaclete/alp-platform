export function zohoTransport(env, request=fetch) {
  const keys=['ZOHO_CLIENT_ID','ZOHO_CLIENT_SECRET','ZOHO_REFRESH_TOKEN','ZOHO_ACCOUNT_ID','ZOHO_FROM'];
  if(!keys.every(key=>env[key]))return null;
  const region=env.ZOHO_REGION||'com';
  if(!['com','eu','in','com.au','jp','ca','sa','com.cn'].includes(region))throw new Error('Invalid Zoho region.');
  if(!/^\d+$/.test(env.ZOHO_ACCOUNT_ID))throw new Error('Invalid Zoho account ID.');
  const accounts=region==='ca'?'accounts.zohocloud.ca':`accounts.zoho.${region}`;
  const mail=region==='ca'?'mail.zohocloud.ca':`mail.zoho.${region}`;
  let token,expires=0,pending;
  async function accessToken(){
    if(token&&Date.now()<expires)return token;
    if(!pending)pending=(async()=>{
      const response=await request(`https://${accounts}/oauth/v2/token`,{method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),body:new URLSearchParams({grant_type:'refresh_token',client_id:env.ZOHO_CLIENT_ID,client_secret:env.ZOHO_CLIENT_SECRET,refresh_token:env.ZOHO_REFRESH_TOKEN})});
      const data=await response.json();
      if(!response.ok||!data.access_token)throw new Error('Zoho authorization failed.');
      token=data.access_token;expires=Date.now()+Math.max(0,Math.min(Number(data.expires_in)||3600,3600)-60)*1000;
      return token;
    })().finally(()=>{pending=null;});
    return pending;
  }
  return {async sendMail(message){
    const access=await accessToken();
    const response=await request(`https://${mail}/api/accounts/${env.ZOHO_ACCOUNT_ID}/messages`,{method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),headers:{Authorization:`Zoho-oauthtoken ${access}`,'Content-Type':'application/json'},body:JSON.stringify({fromAddress:env.ZOHO_FROM,toAddress:message.to,subject:message.subject,content:message.text,mailFormat:'plaintext'})});
    const data=await response.json();
    if(response.status===401){token=null;expires=0;}
    if(!response.ok||data.status?.code!==200||!data.data?.messageId)throw new Error('Zoho delivery was not accepted.');
    return {accepted:[message.to]};
  }};
}
