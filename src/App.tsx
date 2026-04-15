import { useState ,useEffect } from "react";

import Index from './pages/index'
import Login from './pages/login'

import { tokenUtils } from "./utils/auth";

export default function App(){
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    setIsLoggedIn(tokenUtils.isAuthenticated());

    /**
     * @todo 添加后端对于token的校验环节
     */
    /*
    if(token){
      // 简易的token过期校验
      const payload = tokenUtils.decode(token);
      if(payload && payload.expire > Date.now()){
        setIsLoggedIn(true);
      }else{
        localStorage.removeItem(token);
        setIsLoggedIn(false);
      }
    }else{
      setIsLoggedIn(false);
    }*/
  }, [])
  

  if(isLoggedIn === null){
    return <div>Loading ...</div>;
  }

  return(
    <div className="app-container">
      {isLoggedIn ? (
        <Index />
      ):(
        <Login onLogInSuccess={ ()=> setIsLoggedIn(true) }/>
      )}
    </div>
  )
}
