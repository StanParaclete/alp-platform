import React,{useState} from 'react';
import {router} from 'expo-router';
import {useSession} from '../src/session';
import {Page,Label,Copy,Field,Button,ErrorText} from '../src/ui';

export default function Join(){
  const session=useSession();
  const [token,setToken]=useState(''),[email,setEmail]=useState(''),[name,setName]=useState(''),[password,setPassword]=useState(''),[confirm,setConfirm]=useState('');
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[created,setCreated]=useState(false),[acceptedSchool,setAcceptedSchool]=useState(null);
  async function submit(){
    setBusy(true);setError('');
    try{
      if(!acceptedSchool&&!/^[A-Za-z0-9_-]{64}$/.test(token.trim()))throw new Error('Enter the complete invitation code.');
      if(session.signedIn){
        const schoolId=acceptedSchool||(await session.api.request('/auth/invitations/accept',{method:'POST',body:{token:token.trim()}})).schoolId;
        setAcceptedSchool(schoolId);setToken('');await session.reloadProfile(schoolId);router.replace('/');
      }else{
        if(password.length<12 || password!==confirm)throw new Error('Use at least 12 characters and make sure both passwords match.');
        await session.api.registerInvitation({token:token.trim(),email:email.trim().toLowerCase(),name:name.trim(),password});
        setToken('');setPassword('');setConfirm('');setCreated(true);
      }
    }catch(error){setError(error.message);}finally{setBusy(false);}
  }
  return <Page><Label heading>{created?'Account created':'Join a school'}</Label>{created?<><Copy>Your invitation has been accepted.</Copy><Button onPress={()=>router.replace('/login')}>Sign in</Button></>:<>
    {session.signedIn?<Copy>{session.user.email}</Copy>:<Button secondary disabled={busy} onPress={()=>router.replace('/login')}>Sign in to an existing account</Button>}
    <ErrorText>{session.error||error}</ErrorText>
    {acceptedSchool?<Copy>Invitation accepted.</Copy>:<Field label="Invitation code" value={token} onChangeText={setToken} maxLength={64} autoCapitalize="none" autoCorrect={false} secureTextEntry editable={!busy}/>}
    {!session.signedIn?<><Field label="Invited email address" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" maxLength={254} editable={!busy}/><Field label="Full name" value={name} onChangeText={setName} autoComplete="name" maxLength={160} editable={!busy}/><Field label="Password (12 characters minimum)" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" maxLength={256} editable={!busy}/><Field label="Confirm password" value={confirm} onChangeText={setConfirm} secureTextEntry autoComplete="new-password" maxLength={256} editable={!busy}/></>:null}
    <Button disabled={busy||!!session.error||(!token&&!acceptedSchool)||(!session.signedIn&&(!email||!name||!password||!confirm))} onPress={submit}>{busy?'Accepting invitation...':acceptedSchool?'Open school':session.signedIn?'Join school':'Create account'}</Button>
  </>}</Page>;
}
