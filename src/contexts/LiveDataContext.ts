import { createContext, useContext } from "react";
import type { LiveDataResponse } from "../types/LiveData";

export interface LiveDataContextType {
  live_data: LiveDataResponse | null;
  showCallout: boolean;
  onRefresh: (callback: (data: LiveDataResponse) => void) => () => void;
}

export const LiveDataContext = createContext<LiveDataContextType>({
  live_data: null,
  showCallout: true,
  onRefresh: () => () => {},
});

export const useLiveData = () => useContext(LiveDataContext);

export default LiveDataContext;
