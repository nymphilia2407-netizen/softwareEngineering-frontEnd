import { useState ,useEffect } from "react";
import Index from './pages/index'
import Login from './pages/login'

export default function App(){
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');

    /**
     * @todo 添加后端对于token的校验环节
     */
    if(token){
      setIsLoggedIn(true);
    }else{
      setIsLoggedIn(false);
    }
  }, [])

  if(isLoggedIn === null){
    return <div>Loading ...</div>;
  }

  return(
    <div className="app-container">
      {isLoggedIn ? (
        <Index />
      ):(
        <Login />
      )}
    </div>
  )
}