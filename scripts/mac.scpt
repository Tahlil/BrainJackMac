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

display dialog "Name of the browser?" default answer "Safari"
set inp to text returned of result

tell application "System Events"
	if inp is "Google Chrome" then
		tell application "Google Chrome" to return URL of active tab of front window
	else if inp is "Safari" then
		tell application "Safari" to return URL of front document
	else if inp is "Firefox" then
		tell application "Firefox" to activate
		tell application "System Events"
			keystroke "l" using command down
			keystroke "c" using command down
		end tell
		delay 0.5
		return the clipboard
	else
		return
	end if
end tell