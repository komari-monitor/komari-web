import { useContext } from "react";
import LiveDataContext from "@/contexts/LiveNodeDataContext";

const useLiveData = () => useContext(LiveDataContext);

export default useLiveData;