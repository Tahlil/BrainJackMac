tell application "System Events"
    # Get the frontmost app's *process* object.
    set frontAppProcess to first application process whose frontmost is true
end tell

# Tell the *process* to count its windows and return its front window's name.
tell frontAppProcess
    if count of windows > 0 then
       set window_name to name of front window
    end if
end tell
return {frontAppProcess, window_name}
