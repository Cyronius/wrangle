import { createSlice, PayloadAction } from '@reduxjs/toolkit'

export type ThemeMode = 'light' | 'dark'

interface ThemeState {
  currentTheme: ThemeMode
}

const initialState: ThemeState = {
  currentTheme: 'dark'
}

const themeSlice = createSlice({
  name: 'theme',
  initialState,
  reducers: {
    setTheme(state, action: PayloadAction<ThemeMode>) {
      state.currentTheme = action.payload
    }
  }
})

export const { setTheme } = themeSlice.actions
export default themeSlice.reducer
