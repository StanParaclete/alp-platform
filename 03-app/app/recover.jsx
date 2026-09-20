import React,{useState} from 'react';
import {Pressable,Text,View} from 'react-native';
import {Redirect,router,Stack} from 'expo-router';
import {useSession} from '../src/session';
import {resetInput} from '../src/recovery.mjs';
import {Page,Label,Copy,Field,Button,ErrorText,usePalette} from '../src/ui';

export default function Recover(){
  const session=useSession(),c=usePalette();
  const [mode,setMode]=useState('request'),[email,setEmail]=useState(''),[code,setCode]=useState(''),[password,setPassword]=useState(''),[confirmPassword,setConfirmPassword]=useState('');
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[done,setDone]=useState(false);
  if(session.signedIn)return <Redirect href="/"/>;
  async function submit(){
    setBusy(true);setError('');setMessage('');
    try{
      if(mode==='request'){
        const result=await session.api.requestPasswordRecovery(email.trim().toLowerCase());
        setMessage(result.message);setMode('reset');
      }else{
        await session.api.resetPassword(resetInput({email,code,password,confirmPassword}));
        setCode('');setPassword('');setConfirmPassword('');setDone(true);
      }
    }catch(error){setError(error.message);}finally{setBusy(false);}
  }
  return <Page><Stack.Screen options={{title:'Password recovery'}}/><Label heading>{done?'Password changed':'Password recovery'}</Label>{done?<><Copy>Previous sign-in sessions have been revoked.</Copy><Button onPress={()=>router.replace('/login')}>Sign in</Button></>:<>
    <View accessibilityRole="tablist" style={{flexDirection:'row',borderBottomWidth:1,borderColor:c.line}}>{[['request','Request code'],['reset','Reset password']].map(([value,label])=><Pressable key={value} accessibilityRole="tab" accessibilityState={{selected:mode===value,disabled:busy}} disabled={busy} onPress={()=>{setMode(value);setError('');setMessage('');}} style={{flex:1,minHeight:48,alignItems:'center',justifyContent:'center',padding:10,borderBottomWidth:mode===value?3:0,borderColor:c.primary}}><Text style={{fontSize:16,fontWeight:'600',color:mode===value?c.primary:c.muted,textAlign:'center'}}>{label}</Text></Pressable>)}</View>
    {message?<Copy>{message}</Copy>:null}<ErrorText>{session.error||error}</ErrorText>
    <Field label="Account email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" maxLength={254} editable={!busy}/>
    {mode==='reset'?<><Field label="Recovery code" value={code} onChangeText={setCode} autoCapitalize="none" autoCorrect={false} secureTextEntry maxLength={96} editable={!busy}/><Field label="New password (12 characters minimum)" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" maxLength={256} editable={!busy}/><Field label="Confirm new password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry autoComplete="new-password" maxLength={256} editable={!busy}/></>:null}
    <Button disabled={busy||!!session.error||!email.trim()||(mode==='reset'&&(!code||!password||!confirmPassword))} onPress={submit}>{busy?'Working...':mode==='request'?'Request recovery code':'Change password'}</Button>
    <Button secondary disabled={busy} onPress={()=>router.replace('/login')}>Back to sign in</Button>
  </>}</Page>;
}
