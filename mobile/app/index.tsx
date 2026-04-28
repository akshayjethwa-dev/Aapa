import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useState, useEffect } from 'react';
import { apiClient } from '../src/api/client';

export default function Home() {
  const [healthStatus, setHealthStatus] = useState<'loading' | 'online' | 'offline'>('loading');

  const pingRailwayBackend = async () => {
    setHealthStatus('loading');
    try {
      // Pinging the standard health check endpoint on your backend
      const response = await apiClient.get('/api/health');
      if (response.status === 200) {
        setHealthStatus('online');
      } else {
        setHealthStatus('offline');
      }
    } catch (error) {
      console.error("Railway backend ping failed:", error);
      setHealthStatus('offline');
    }
  };

  useEffect(() => {
    pingRailwayBackend();
  }, []);

  return (
    <View className="flex-1 items-center justify-center bg-gray-50 p-4">
      <Text className="text-3xl font-bold text-primary mb-2">
        Mobile Environment Ready
      </Text>
      
      <View className="bg-white p-6 rounded-2xl shadow-sm w-full max-w-sm border border-gray-100">
        <Text className="text-gray-600 text-base mb-4 text-center">
          Tailwind CSS (NativeWind) is rendering correctly on native components.
        </Text>

        <View className="flex-row items-center justify-center mb-6">
          <Text className="text-gray-800 font-medium mr-2">Railway API Status:</Text>
          {healthStatus === 'loading' ? (
            <ActivityIndicator size="small" color="#3b82f6" />
          ) : (
            <View className={`px-3 py-1 rounded-full ${healthStatus === 'online' ? 'bg-green-100' : 'bg-red-100'}`}>
              <Text className={`${healthStatus === 'online' ? 'text-green-700' : 'text-red-700'} font-bold uppercase text-xs`}>
                {healthStatus}
              </Text>
            </View>
          )}
        </View>

        <TouchableOpacity 
          onPress={pingRailwayBackend}
          className="bg-brand py-3 px-6 rounded-xl active:bg-blue-600"
        >
          <Text className="text-white text-center font-semibold text-lg">
            Retry Connection
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}