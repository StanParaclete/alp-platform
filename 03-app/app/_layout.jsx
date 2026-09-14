import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { AppState, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as ScreenCapture from 'expo-screen-capture';
import { SessionProvider } from '../src/session';
import { Credit, Label, usePalette } from '../src/ui';
function Shell() {
  const c=usePalette();const [active,setActive]=useState(AppState.currentState==='active');
  useEffect(()=>{ScreenCapture.preventScreenCaptureAsync().catch(()=>{});const sub=AppState.addEventListener('change',value=>setActive(value==='active'));return()=>{sub.remove();ScreenCapture.allowScreenCaptureAsync().catch(()=>{});};},[]);
  return <SafeAreaView edges={['bottom']} style={{flex:1,backgroundColor:c.bg}}><StatusBar style="auto"/><Stack screenOptions={{headerStyle:{backgroundColor:c.surface},headerTintColor:c.ink,contentStyle:{backgroundColor:c.bg}}}><Stack.Screen name="login" options={{title:'ALP'}}/><Stack.Screen name="(workspace)" options={{headerShown:false}}/></Stack><Credit/>{!active?<View style={{position:'absolute',inset:0,backgroundColor:c.bg,alignItems:'center',justifyContent:'center'}}><Label heading>ALP</Label></View>:null}</SafeAreaView>;
}
export default function Root(){return <SafeAreaProvider><SessionProvider><Shell/></SessionProvider></SafeAreaProvider>;}
