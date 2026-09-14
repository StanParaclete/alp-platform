import React,{useState} from 'react';
import {Image,Switch,View} from 'react-native';
import {Redirect} from 'expo-router';
import {useSession} from '../src/session';
import {Page,Label,Copy,Field,Button,ErrorText} from '../src/ui';
export default function Login(){const session=useSession();const[email,setEmail]=useState(''),[password,setPassword]=useState(''),[remember,setRemember]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
  if(session.signedIn)return <Redirect href="/"/>;
  async function run(action){setBusy(true);setError('');try{await action();setPassword('');}catch(error){setError(error.message);}finally{setBusy(false);}}
  return <Page><Image source={require('../assets/icon.png')} style={{width:88,height:88,alignSelf:'center'}} accessibilityLabel="ALP"/><Label heading>Accelerated Learning Plan</Label><Copy>Sign in to your school workspace.</Copy><ErrorText>{session.error||error}</ErrorText><Field label="Email address" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email"/><Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password"/><View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12}}><View style={{flex:1}}><Label>Use biometric sign-in</Label></View><Switch accessibilityLabel="Use biometric sign-in" value={remember} onValueChange={setRemember} trackColor={{true:'#8F16B8'}}/></View><Button disabled={busy||!!session.error||!email||!password} onPress={()=>run(()=>session.signIn(email,password,remember))}>{busy?'Signing in...':'Sign in'}</Button><Button secondary disabled={busy||!!session.error} onPress={()=>run(session.unlock)}>Unlock saved sign-in</Button></Page>;
}
