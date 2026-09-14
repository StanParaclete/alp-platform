import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useColorScheme } from 'react-native';
import { useSession } from './session';
export function usePalette() { return useColorScheme() === 'dark' ? { bg: '#100D13', surface: '#1B171F', ink: '#F8F6FA', muted: '#C3B8CA', line: '#493C52', primary: '#D58BE8' } : { bg: '#F8F6FA', surface: '#FFFFFF', ink: '#231C28', muted: '#685D70', line: '#D8D0DD', primary: '#8F16B8' }; }
export function Page({ children }) { const c=usePalette(); return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[s.page,{backgroundColor:c.bg}]}>{children}</ScrollView>; }
export function Label({children,heading=false}) { const c=usePalette();return <Text style={[heading?s.heading:s.label,{color:c.ink}]}>{children}</Text>; }
export function Copy({children}) { const c=usePalette();return <Text style={[s.copy,{color:c.muted}]}>{children}</Text>; }
export function Field({label,...props}) { const c=usePalette();return <View style={s.field}><Label>{label}</Label><TextInput accessibilityLabel={label} placeholderTextColor={c.muted} style={[s.input,{color:c.ink,borderColor:c.line,backgroundColor:c.surface},props.multiline&&s.multiline]} {...props}/></View>; }
export function Button({children,onPress,disabled=false,secondary=false}) {const c=usePalette();return <Pressable accessibilityRole="button" accessibilityState={{disabled}} disabled={disabled} onPress={onPress} style={({pressed})=>[s.button,{backgroundColor:secondary?c.surface:'#8F16B8',borderColor:c.line,opacity:disabled?.5:pressed?.8:1}]}><Text style={{color:secondary?c.ink:'#FFFFFF',fontSize:16,fontWeight:'600',textAlign:'center'}}>{children}</Text></Pressable>;}
export function Row({title,detail,onPress}) { const c=usePalette();return <Pressable accessibilityRole="button" onPress={onPress} style={[s.row,{borderColor:c.line}]}><Text style={[s.label,{color:c.ink}]}>{title}</Text>{detail?<Copy>{detail}</Copy>:null}</Pressable>; }
export function ErrorText({children}) { return children?<Text accessibilityRole="alert" style={s.error}>{children}</Text>:null; }
export function Busy() { const c=usePalette();return <ActivityIndicator style={{margin:24}} color={c.primary} accessibilityLabel="Loading"/>; }
export function Credit() { const c=usePalette();return <View style={[s.credit,{backgroundColor:c.bg,borderColor:c.line}]}><Text style={{color:c.muted,fontSize:12}}>Built by <Text accessibilityRole="link" style={{color:c.primary,textDecorationLine:'underline'}} onPress={()=>Linking.openURL('https://www.stanparaclete.com')}>Stan Paraclete</Text></Text></View>; }
export function useResource(path) {
  const {api,school}=useSession();const [state,setState]=useState({data:null,error:'',loading:true}),[version,reload]=useState(0);
  useEffect(()=>{let active=true;setState({data:null,error:'',loading:true});if(!path||!school){setState({data:null,error:'',loading:false});return;}
    api.request(path,{school:school.school.id}).then(data=>{if(active)setState({data,error:'',loading:false});}).catch(error=>{if(active)setState({data:null,error:error.message,loading:false});});return()=>{active=false;};
  },[api,school,path,version]);
  return {...state,reload:()=>reload(value=>value+1)};
}
export const s=StyleSheet.create({page:{padding:22,paddingBottom:40,flexGrow:1,gap:12},heading:{fontSize:24,fontWeight:'700',lineHeight:31},label:{fontSize:16,fontWeight:'600',lineHeight:24},copy:{fontSize:15,lineHeight:23},field:{gap:6,marginVertical:6},input:{borderWidth:1,borderRadius:6,padding:13,fontSize:16,minHeight:48},multiline:{minHeight:180,textAlignVertical:'top'},button:{minHeight:48,borderWidth:1,borderRadius:6,padding:13,justifyContent:'center',marginVertical:3},row:{paddingVertical:17,borderBottomWidth:1,gap:5},error:{color:'#BD405B',fontSize:15,lineHeight:23},credit:{padding:9,alignItems:'center',borderTopWidth:1}});
