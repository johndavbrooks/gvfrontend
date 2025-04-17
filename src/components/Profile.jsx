import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import "./Profile.css";
import profileImage from "../assets/temp-profile.webp";
import axios from "axios";
import { ToastContainer, toast } from 'react-toastify';
import { useNavigate } from "react-router-dom";
import { FixedSizeList as List } from 'react-window';
import PropTypes from 'prop-types';
import { base_url, image_url } from "../config";

// Add this custom hook at the top with other imports
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// Add this validation function near the top of your Profile component
const validateEmail = (email) => {
  // Regular expression for basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Add this component at the top of your file
const ProfileSkeleton = () => (
  <div className="profile-card">
    <div className="profile-header">
      <div className="profile-image-container skeleton"></div>
      <div className="skeleton-text"></div>
      <div className="skeleton-tags">
        <div className="skeleton-tag"></div>
        <div className="skeleton-tag"></div>
      </div>
    </div>
  </div>
);

// Add this component near the top of your file with other component declarations
const DayRow = React.memo(({ day, index, toggleHourAvailability, updatingHours }) => {
  return (
    <div className="day-row">
      <span className="day-name">{day.name}</span>
      <div className="hour-blocks">
        {day.hours.map((isAvailable, hourIndex) => {
          const stringIndex = index * 24 + hourIndex;
          const isUpdating = updatingHours.has(stringIndex);
          
          return (
            <div 
              key={hourIndex} 
              className={`hour-block ${isAvailable === '1' ? 'available' : ''} ${isUpdating ? 'updating' : ''}`}
              title={`${day.name} ${hourIndex}:00-${hourIndex+1}:00`}
              onClick={() => toggleHourAvailability(index, hourIndex)}
              style={{ 
                cursor: isUpdating ? 'wait' : 'pointer',
                position: 'relative'
              }}
            >
              {isUpdating && (
                <div className="hour-update-indicator"></div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});

// Add display name
DayRow.displayName = 'DayRow';

// Add prop validations
DayRow.propTypes = {
  day: PropTypes.shape({
    name: PropTypes.string.isRequired,
    hours: PropTypes.array.isRequired
  }).isRequired,
  index: PropTypes.number.isRequired,
  toggleHourAvailability: PropTypes.func.isRequired,
  updatingHours: PropTypes.shape({
    has: PropTypes.func.isRequired
  }).isRequired
};

function Profile() {
  const [userData, setUserData] = useState(null);
  const [availability, setAvailability] = useState({
    day: "",
    startTime: "",
    endTime: ""
  });
  const [availabilityString, setAvailabilityString] = useState("0".repeat(168));
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editedDescription, setEditedDescription] = useState("");
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editedProfileData, setEditedProfileData] = useState({
    name: "",
    userEmail: "",
    majors: [],
    majorsString: ""
  });
  const [emailError, setEmailError] = useState("");
  // Add state for profile picture
  const [profilePicture, setProfilePicture] = useState(null);
  const [isUploadingPicture, setIsUploadingPicture] = useState(false);
  const fileInputRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  // Add a state for the delete confirmation modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  // Add a new state variable for password visibility
  const [showPassword, setShowPassword] = useState(false);
  const sessionId = localStorage.getItem('sessionId');
  const navigate = useNavigate();
  const [searchEnabled, setSearchEnabled] = useState(false);
  const [userRole, setUserRole] = useState('');
  const [coursesData, setCoursesData] = useState([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [updatingHours, setUpdatingHours] = useState(new Set());
  const [updateError, setUpdateError] = useState(null);
  const updateToastId = useRef(null);
  const [descriptionInput, setDescriptionInput] = useState("");
  const debouncedDescription = useDebounce(descriptionInput, 300);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);

  // Add this near your other useMemo hooks
  const timeIndicators = useMemo(() => {
    return [0, 3, 6, 9, 12, 15, 18, 21].map((hour) => (
      <div key={hour} className="time-indicator">
        <span>{hour}:00</span>
      </div>
    ));
  }, []);

  // Use the effect to update the actual editedDescription
  useEffect(() => {
    setEditedDescription(debouncedDescription);
  }, [debouncedDescription]);

  // Format week availability for rendering (prevent recalculation on every render)
  const formattedAvailability = useMemo(() => {
    // Process the availabilityString into a structured format
    if (!availabilityString) return [];
    
    return ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
      .map((day, index) => {
        const dayStart = index * 24;
        const hours = availabilityString.slice(dayStart, dayStart + 24).split('');
        return { name: day, hours };
      });
  }, [availabilityString]);

  const fetchUserProfile = async () => {
    const storedUserData = localStorage.getItem('userData');
    if (!storedUserData) {
      toast.error("User data not found. Please login again.");
      setTimeout(() => window.location.href = '/', 2000);
      return null;
    }
    
    const parsedData = JSON.parse(storedUserData);
    setUserData(parsedData); // Set initial data from localStorage first
    
    try {
      // Then fetch fresh data from server
      const response = await axios.get(
        `${base_url}/users/${parsedData.userEmail}`,
        { headers: { 'Session-Id': sessionId } }
      );
      
      // Merge server data with local data, preferring server values
      const mergedData = {
        ...parsedData,
        ...response.data,
        // Handle any special field merging here
      };
      
      // Update local storage with fresh data
      localStorage.setItem('userData', JSON.stringify(mergedData));
      setUserData(mergedData);
      
      return mergedData;
    } catch (error) {
      console.error('Error fetching user data:', error);
      return parsedData; // Return localStorage data as fallback
    }
  };

  useEffect(() => {
    if (!sessionId) {
      toast.error("Session expired. Please login again.");
      setTimeout(() => window.location.href = '/', 2000);
      return;
    }

    setIsLoading(true);
    fetchUserProfile().then((parsedData) => {
      if (parsedData) {
        setEditedDescription(parsedData.biography || "");
        
        // Store the majors array and create the display string
        setEditedProfileData({
          name: parsedData.name || "",
          userEmail: parsedData.userEmail || "",
          majors: parsedData.majors || [],
          majorsString: (parsedData.majors || []).join(', ')
        });
        
        // If the user already has availability data, load it
        if (parsedData.weeklyAvailability) {
          setAvailabilityString(parsedData.weeklyAvailability);
        }
        
        // Update user role from server response
        if (parsedData.role) {
          const role = parsedData.role || 'Student';
          setUserRole(role);
          
          // Update searchEnabled based on role
          const isTeachingRole = ['INSTRUCTOR', 'GTA', 'UTA'].includes(role);
          setSearchEnabled(isTeachingRole);
          
          // Update global searchEnabled variable
          window.searchEnabled = isTeachingRole;
        }
      }
    }).finally(() => setIsLoading(false));
  }, [sessionId]);

  // Complete and optimize the fetchProfilePicture function
  const fetchProfilePicture = useCallback(async (fileId) => {
    console.log("fetchProfilePicture called with ID:", fileId);
    
    if (!fileId || fileId === 'undefined') {
      console.log("Invalid fileId detected:", fileId);
      setProfilePicture(profileImage); // Set default image
      return;
    }
    
    // Check for cached image URL first
    const cachedUrl = sessionStorage.getItem(`profile-image-${fileId}`);
    if (cachedUrl) {
      console.log("Using cached profile image:", cachedUrl);
      setProfilePicture(cachedUrl);
      return;
    }
    
    try {
      // For database stored URLs, we need to check if it's a full URL or just an ID
      let imageUrl;
      
      if (fileId.startsWith('http')) {
        // If it's a full URL, use it directly
        imageUrl = fileId;
      } else {
        // Otherwise construct the URL using the file ID
        imageUrl = `${image_url}/images/${fileId}`;
      }
      
      console.log("Attempting to load image from URL:", imageUrl);
      
      // Verify the image loads correctly
      const img = new Image();
      
      // Create a promise to handle image loading
      const imageLoadPromise = new Promise((resolve, reject) => {
        img.onload = () => {
          console.log("Image loaded successfully:", imageUrl);
          resolve(imageUrl);
        };
        
        img.onerror = () => {
          console.error("Failed to load image from primary URL:", imageUrl);
          // Try alternative URL format if the first one fails
          if (!fileId.startsWith('http')) {
            const alternativeUrl = `${base_url}/api/files/getImage/${fileId}`;
            console.log("Trying alternative URL:", alternativeUrl);
            
            const altImg = new Image();
            altImg.onload = () => {
              console.log("Alternative URL loaded successfully");
              resolve(alternativeUrl);
            };
            
            altImg.onerror = () => {
              console.error("Failed to load image from alternative URL");
              reject(new Error("Failed to load profile image"));
            };
            
            altImg.src = alternativeUrl;
          } else {
            reject(new Error("Failed to load profile image"));
          }
        };
      });
      
      // Start loading the image
      img.src = imageUrl;
      
      // Wait for image load resolution
      const successfulUrl = await imageLoadPromise;
      
      // Cache the successful URL
      sessionStorage.setItem(`profile-image-${fileId}`, successfulUrl);
      
      // Set the profile picture URL
      setProfilePicture(successfulUrl);
      
      return successfulUrl;
    } catch (error) {
      console.error('Error fetching profile picture:', error);
      // Fall back to default image
      setProfilePicture(profileImage);
    }
  }, []);

  // Add this useEffect to call fetchProfilePicture when user data changes
  useEffect(() => {
    if (userData) {
      if (userData.profilePictureUrl) {
        fetchProfilePicture(userData.profilePictureUrl);
      } else if (userData.profilePictureId) {
        fetchProfilePicture(userData.profilePictureId);
      } else {
        // No profile picture data available, use default
        setProfilePicture(profileImage);
      }
    }
  }, [userData, fetchProfilePicture]);

  useEffect(() => {
    const fetchUserCourses = async () => {
      if (!userData?.userEmail) return;
      
      setCoursesLoading(true);
      
      try {
        const sessionId = localStorage.getItem('sessionId');
        
        const response = await axios.get(
          `${base_url}/users/${userData.userEmail}/courses`,
          {
            headers: {
              'Session-Id': sessionId
            }
          }
        );
        
        console.log('Courses data fetched:', response.data);
        setCoursesData(response.data || []);
      } catch (error) {
        console.error('Error fetching courses:', error);
        
      } finally {
        setCoursesLoading(false);
      }
    };
    
    fetchUserCourses();
  }, [userData?.userEmail]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Allow Escape key to cancel edits
      if (e.key === 'Escape') {
        if (isEditingProfile) {
          setIsEditingProfile(false);
        } else if (isEditingDescription) {
          setIsEditingDescription(false);
        }
      }
      
      // Allow Ctrl+S to save
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        if (isEditingProfile) {
          handleSaveProfile();
        } else if (isEditingDescription) {
          handleSaveDescription();
        }
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditingProfile, isEditingDescription]);

  const handleRoleChange = async (event) => {
    const newRole = event.target.value;
    
    try {
      const response = await axios.put(
        `${base_url}/users/${userData.userEmail}`,
        { role: newRole },
        {
          headers: {
            'Content-Type': 'application/json',
            'Session-Id': sessionId
          }
        }
      );
  
      if (response.status === 200) {
        setUserRole(newRole);
        
        // Update searchEnabled based on new role
        const isTeachingRole = ['INSTRUCTOR', 'GTA', 'UTA'].includes(newRole);
        setSearchEnabled(isTeachingRole);
        
        // Update global searchEnabled variable
        window.searchEnabled = isTeachingRole;
        
        // Update localStorage
        const updatedUserData = { ...userData, role: newRole };
        localStorage.setItem('userData', JSON.stringify(updatedUserData));
        setUserData(updatedUserData);
        
        toast.success('Role updated successfully!');
      }
    } catch (error) {
      console.error('Error updating role:', error);
      toast.error('Failed to update role. Please try again.');
    }
  };
  

  const handleAvailabilityChange = (e) => {
    setAvailability({
      ...availability,
      [e.target.name]: e.target.value
    });
  };

  const saveAvailability = async () => {
    const { day, startTime, endTime } = availability;
    
    if (!day || !startTime || !endTime) {
      toast.warning("Please select a day, start time, and end time");
      return;
    }
  
    setAvailabilityLoading(true);
    
    // Convert day to starting index (24 hours per day)
    const dayIndices = {
      "monday": 0,
      "tuesday": 24,
      "wednesday": 48,
      "thursday": 72,
      "friday": 96,
      "saturday": 120,
      "sunday": 144
    };
    
    const dayIndex = dayIndices[day];
    
    // Convert time strings to hours
    const startHour = parseInt(startTime.split(":")[0]);
    const endHour = parseInt(endTime.split(":")[0]);
    
    if (startHour >= endHour) {
      toast.warning("End time must be after start time");
      setAvailabilityLoading(false);
      return;
    }
  
    // Create a new availability string
    let newAvailabilityString = availabilityString.split('');
    
    // Mark the hours as available (1)
    for (let hour = startHour; hour < endHour; hour++) {
      newAvailabilityString[dayIndex + hour] = '1';
    }
    
    const updatedAvailabilityString = newAvailabilityString.join('');
  
    if (!userData) {
      setAvailabilityLoading(false);
      return;
    }
  
    try {
      
      if (!sessionId) {
        toast.error("You must be logged in to save availability");
        setAvailabilityLoading(false);
        return;
      }
  
      const response = await axios.put(
        `${base_url}/users/${userData.userEmail}`,
        { weeklyAvailability: updatedAvailabilityString },
        {
          headers: {
            'Content-Type': 'application/json',
            'Session-Id': sessionId
          }
        }
      );
  
      if (response.status === 200) {
        setAvailabilityString(updatedAvailabilityString);
        
        // Update the stored user data
        const updatedUserData = { ...userData, weeklyAvailability: updatedAvailabilityString };
        localStorage.setItem('userData', JSON.stringify(updatedUserData));
        setUserData(updatedUserData);
        
        toast.success("Availability saved successfully!");
      }
    } catch (error) {
      console.error('Error saving availability:', error);
      toast.error("Failed to save availability. Please try again.");
    } finally {
      setAvailabilityLoading(false);
    }
  };

  const updateAvailabilityOnServer = useCallback(async (updatedString, hourIndex = null) => {
    if (!userData || !sessionId) return;
    
    try {
      setUpdateError(null);
      
      const response = await axios.put(
        `${base_url}/users/${userData.userEmail}`,
        { weeklyAvailability: updatedString },
        {
          headers: {
            'Content-Type': 'application/json',
            'Session-Id': sessionId
          }
        }
      );
      
      if (response.status === 200) {
        // Update stored user data
        const updatedUserData = { ...userData, weeklyAvailability: updatedString };
        localStorage.setItem('userData', JSON.stringify(updatedUserData));
        setUserData(updatedUserData);
        
        // Update toast message if we're updating a specific hour
        if (hourIndex !== null && updateToastId.current) {
          // Use formattedAvailability to get day and hour info
          const day = Math.floor(hourIndex / 24);
          const hour = hourIndex % 24;
          const dayName = formattedAvailability[day]?.name || 
                        ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][day];
          
          toast.update(updateToastId.current, {
            render: updatedString[hourIndex] === '1' 
              ? `Added availability for ${dayName} at ${hour}:00` 
              : `Removed availability for ${dayName} at ${hour}:00`,
            type: "success",
            isLoading: false,
            autoClose: 1500
          });
        }
      }
    } catch (error) {
      // Error handling code remains the same
      console.error('Error updating availability:', error);
      
      // Show error toast
      if (hourIndex !== null && updateToastId.current) {
        toast.update(updateToastId.current, {
          render: "Failed to update availability. Please try again.",
          type: "error",
          isLoading: false,
          autoClose: 3000
        });
      } else {
        toast.error("Failed to update availability");
      }
      
      // Revert the local state to the previous value from userData
      if (userData?.weeklyAvailability) {
        setAvailabilityString(userData.weeklyAvailability);
      }
      
      setUpdateError("Failed to update. Please try again.");
    } finally {
      // Remove this hour from the updating set
      if (hourIndex !== null) {
        setUpdatingHours(prev => {
          const updated = new Set([...prev]);
          updated.delete(hourIndex);
          return updated;
        });
      }
    }
  }, [userData, sessionId, updateToastId, formattedAvailability]);

  const toggleHourAvailability = useCallback((dayIndex, hourIndex) => {
    const stringIndex = dayIndex * 24 + hourIndex;
    
    // Don't allow toggling if this hour is already being updated
    if (updatingHours.has(stringIndex)) return;
    
    // Add this hour to the updating set
    setUpdatingHours(prev => new Set([...prev, stringIndex]));
    
    // Create new string with toggled value
    let newAvailabilityString = availabilityString.split('');
    newAvailabilityString[stringIndex] = newAvailabilityString[stringIndex] === '1' ? '0' : '1';
    const updatedAvailabilityString = newAvailabilityString.join('');
    
    // Optimistically update the UI
    setAvailabilityString(updatedAvailabilityString);
    
    // Show a toast notification for the update
    if (updateToastId.current) {
      toast.dismiss(updateToastId.current);
    }
    
    updateToastId.current = toast.loading(
      newAvailabilityString[stringIndex] === '1' 
        ? "Adding availability..."
        : "Removing availability..."
    );
    
    // Update server
    updateAvailabilityOnServer(updatedAvailabilityString, stringIndex);
  }, [availabilityString, updatingHours, updateAvailabilityOnServer]);

  const handleEditDescription = () => {
    setIsEditingDescription(true);
  };

  const handleSaveDescription = async () => {
    if (!userData) return;

    try {
      
      if (!sessionId) {
        toast.error("You must be logged in to save description");
        return;
      }

      const response = await axios.put(
        `${base_url}/users/${userData.userEmail}`,
        { biography: editedDescription },
        {
          headers: {
            'Content-Type': 'application/json',
            'Session-Id': sessionId
          }
        }
      );

      if (response.status === 200) {
        // Update the stored user data
        const updatedUserData = { ...userData, biography: editedDescription };
        localStorage.setItem('userData', JSON.stringify(updatedUserData));
        setUserData(updatedUserData);
        setIsEditingDescription(false);
        
        toast.success("Description saved successfully!");
      }
    } catch (error) {
      console.error('Error saving description:', error);
      toast.error("Failed to save description. Please try again.");
    }
  };

  const handleEditProfile = () => {
    setIsEditingProfile(true);
  };

  const handleDeleteProfile = () => {
    setShowDeleteModal(true);
  };

  const confirmDeleteProfile = async () => {
    if (!deletePassword) {
      toast.error("Please enter your password");
      return;
    }
  
    if (!userData || !userData.userEmail) {
      toast.error("Missing user data. Please refresh and try again.");
      return;
    }
  
    try {
      if (!sessionId) {
        toast.error("Session expired. Please login again.");
        setTimeout(() => window.location.href = '/', 2000);
        return;
      }
      
      const response = await axios({
        method: 'DELETE',
        url: `${base_url}/users/${userData.userEmail}`,
        headers: {
          'Content-Type': 'application/json',
          'Session-Id': sessionId
        },
        data: {
          password: deletePassword
        }
      });
      
      if (response.status >= 200 && response.status < 300) {
        toast.success("Your account has been successfully deleted. You will be redirected to the login page.", {
          onClose: () => { window.location.href = '/'; }
        });

        localStorage.clear();
        document.body.classList.add('fade-out');
        setTimeout(() => { window.location.href = '/'; }, 2000);
      } else {
        toast.error(`Unexpected response: ${response.status}`);
      }
    } catch (error) {
      toast.dismiss("deleting");
      
      if (error.response) {
        switch (error.response.status) {
          case 401:
            toast.error("Incorrect password. Please try again.");
            break;
          case 403:
            toast.error("You don't have permission to delete this account.");
            break;
          case 404:
            toast.error("User not found. You may have already deleted this account.");
            break;
          case 500:
            toast.error("Server error. Please try again later.");
            break;
          default:
            toast.error(`Error (${error.response.status}): ${error.response.data.message || 'Unknown error'}`);
        }
      } else if (error.request) {
        toast.error("No response from server. Please check your connection.");
      } else {
        toast.error(`Request failed: ${error.message}`);
      }
    }
  
    setShowDeleteModal(false);
  };

  // Update the handleProfileInputChange function to validate email as the user types
  const handleProfileInputChange = (e) => {
    const { name, value } = e.target;
    
    if (name === "majors") {
      // Convert comma-separated string to array
      setEditedProfileData({
        ...editedProfileData,
        [name]: value.split(',').map(item => item.trim()).filter(item => item !== ""),
        majorsString: value // Update the raw input string
      });
    } else if (name === "userEmail") {
      // Update the email in the state
      setEditedProfileData({
        ...editedProfileData,
        [name]: value
      });
      
      // Validate email format and provide feedback
      if (value && !validateEmail(value)) {
        setEmailError("Please enter a valid email address");
      } else {
        setEmailError("");
      }
    } else {
      setEditedProfileData({
        ...editedProfileData,
        [name]: value
      });
    }
  };

  // Update the handleSaveProfile function to include email validation
  const handleSaveProfile = async () => {
    if (!userData) return;

    // Validate email
    if (!validateEmail(editedProfileData.userEmail)) {
      toast.error("Please enter a valid email address");
      return;
    }
    
    // Add confirmation dialog
    const confirmSave = window.confirm("Are you sure you want to save these changes to your profile?");
    
    if (!confirmSave) {
      return; // User canceled the action
    }
  
    try {
      
      if (!sessionId) {
        toast.error("You must be logged in to save profile information");
        return;
      }
  
      const response = await axios.put(
        `${base_url}/users/${userData.userEmail}`,
        editedProfileData,
        {
          headers: {
            'Content-Type': 'application/json',
            'Session-Id': sessionId
          }
        }
      );
  
      if (response.status === 200) {
        // Update the stored user data
        const updatedUserData = { ...userData, ...editedProfileData };
        localStorage.setItem('userData', JSON.stringify(updatedUserData));
        setUserData(updatedUserData);
        setIsEditingProfile(false);
        
        toast.success("Profile information saved successfully!");
        
      }
    } catch (error) {
      console.error('Error saving profile information:', error);
      toast.error("Failed to save profile information. Please try again.");
    }
  };

  // Add this function to your Profile component
  const handleRemoveLocation = (locationId, locationName) => {
    if (!userData) return;
    
    // Ask for confirmation before removing
    if (!window.confirm(`Remove ${locationName} from your preferred locations?`)) {
      return;
    }
    
    // Filter out the location to remove
    const updatedLocations = userData.preferredLocations.filter(id => id !== locationId);
    
    // Create updated user data
    const updatedUserData = {
      ...userData,
      preferredLocations: updatedLocations
    };
    
    // Update local state
    setUserData(updatedUserData);
    
    // Update localStorage
    localStorage.setItem('userData', JSON.stringify(updatedUserData));
    
    // Update on the server
    const sessionId = localStorage.getItem('sessionId');
    if (sessionId) {
      axios.put(
        `${base_url}/users/${userData.userEmail}`,
        { preferredLocations: updatedLocations },
        {
          headers: {
            'Content-Type': 'application/json',
            'Session-Id': sessionId
          }
        }
      ).then(() => {
        toast.success(`Removed ${locationName} from your preferred locations.`);
      }).catch(error => {
        console.error('Error removing location:', error);
        toast.error('Error removing location. Please try again.');
      });
    }
  };

  // Update the handleProfilePictureUpload function with proper field name handling
  const handleProfilePictureUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast.error("Please upload an image file (JPEG, PNG, GIF, or WEBP)");
      return;
    }
    
    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image size should be less than 2MB");
      return;
    }
    
    // Create form data for upload
    const formData = new FormData();
    formData.append('file', file);
    
    // Show upload indicator
    setIsUploadingPicture(true);
    
    try {
      const sessionId = localStorage.getItem('sessionId');
      
      if (!sessionId) {
        toast.error("You must be logged in to upload a profile picture");
        setIsUploadingPicture(false);
        return;
      }
      
      console.log("Uploading file:", file.name, "size:", file.size);
      
      // Step 1: Upload the file
      const response = await axios.post(
        `${base_url}/api/files/upload`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            'Session-Id': sessionId
          }
        }
      );
      
      console.log("Upload response:", response.data);
      
      if (response.status === 200 && response.data) {
        // Extract the file ID and URL from the response
        const fileId = response.data.fileName || response.data.fileId;
        const publicUrl = response.data.publicUrl;
        
        if (!fileId) {
          console.error("Invalid fileId in response");
          toast.error("Failed to get valid file ID from server");
          return;
        }
        
        // Use the public URL if available, otherwise construct it
        const imageUrl = publicUrl || `${image_url}/images/${fileId}`;
        console.log("Setting profile picture URL:", imageUrl);
        
        // Update local state first for immediate feedback
        setProfilePicture(imageUrl);
        
        // Update local storage
        const updatedUserData = {
          ...userData,
          profilePictureUrl: imageUrl
        };
        localStorage.setItem('userData', JSON.stringify(updatedUserData));
        setUserData(updatedUserData);
        setProfilePicture(imageUrl);

        // Dispatch event to notify other components
        window.dispatchEvent(new Event('storage'));

        toast.success("Profile picture updated successfully!");
        
        // Try one field at a time to find which one works
        const updateMethods = [
          // Method 1: Just use the field name as is
          async () => {
            console.log("Trying update with profilePictureUrl field");
            return await axios.put(
              `${base_url}/users/${userData.userEmail}`,
              { profilePictureUrl: imageUrl },
              { headers: { 'Content-Type': 'application/json', 'Session-Id': sessionId } }
            );
          },
          
          // Method 2: Try with snake_case
          async () => {
            console.log("Trying update with profile_picture_url field");
            return await axios.put(
              `${base_url}/users/${userData.userEmail}`,
              { profile_picture_url: imageUrl },
              { headers: { 'Content-Type': 'application/json', 'Session-Id': sessionId } }
            );
          },
          
          // Method 3: Try with just the file ID
          async () => {
            console.log("Trying update with profilePictureId field");
            return await axios.put(
              `${base_url}/users/${userData.userEmail}`,
              { profilePictureId: fileId },
              { headers: { 'Content-Type': 'application/json', 'Session-Id': sessionId } }
            );
          }
        ];
        
        let success = false;
        
        // Try each method until one works
        for (const method of updateMethods) {
          try {
            const updateResponse = await method();
            console.log("Update response:", updateResponse.status, updateResponse.data);
            
            // Verify if it worked by checking the response data
            if (updateResponse.data && 
                (updateResponse.data.profilePictureUrl || updateResponse.data.profile_picture_url)) {
              console.log("Update successful!");
              success = true;
              break;
            }
          } catch (error) {
            console.log("Update attempt failed:", error.message);
            // Continue to the next method
          }
        }
        
        // Show toast based on success
        if (success) {
          toast.success("Profile picture updated successfully!");
        } else {
          // The update might have failed server-side but still show it client-side
          toast.warning("Profile picture updated locally but may not be saved on the server.");
        }
      } else {
        console.error("Unexpected response:", response);
        toast.error("Failed to upload profile picture");
      }
    } catch (error) {
      console.error('Error in profile picture upload process:', error);
      toast.error("Failed to upload profile picture. Please try again later.");
    } finally {
      setIsUploadingPicture(false);
    }
  };

  if (isLoading) {
    return (
      <div className="profile-loading">
        <ProfileSkeleton />
      </div>
    );
  }

  return (
    <div className={`profile-page role-${userRole.toLowerCase()}`}>
      <div className="profile-sidebar">
        <div className="profile-card">
          <div className="profile-header">
            <div 
              className="profile-image-container"
              onClick={() => fileInputRef.current && fileInputRef.current.click()}
              style={{ cursor: 'pointer' }}
              title="Click to change profile picture"
            >
              {isUploadingPicture && (
                <div className="profile-image-loading">
                  <div className="spinner"></div>
                </div>
              )}
              <img 
                src={profilePicture && profilePicture !== `${image_url}/images/undefined` 
                  ? profilePicture 
                  : profileImage} 
                alt="Profile" 
                className="profile-image"
                onError={(e) => {
                  console.error("Failed to load image:", e.target.src);
                  // Add a retry attempt before falling back to default
                  if (e.target.src !== profileImage && !e.target.dataset.retried) {
                    console.log("Retrying image load after error");
                    e.target.dataset.retried = "true";
                    // Force a cache refresh by adding a timestamp
                    setTimeout(() => {
                      e.target.src = e.target.src + "?t=" + new Date().getTime();
                    }, 500);
                  } else if (e.target.src !== profileImage) {
                    console.log("Falling back to default image after retry");
                    e.target.src = profileImage;
                  }
                }}
              />
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                accept="image/*"
                onChange={handleProfilePictureUpload}
              />
              <div className="profile-image-overlay">
                <span className="upload-icon">📷</span>
                <span className="upload-text">Click to change</span>
              </div>
            </div>
            <h2 className="name">{userData?.name || "Loading..."}</h2>
            {userData?.majors?.length > 0 ? (
              <div className="tag-container">
                {userData.majors.map((major, index) => (
                  <span key={index} className="tag">{major}</span>
                ))}
              </div>
            ) : (
              <div className="tag-container">
                <span className="tag">CS</span>
              </div>
            )}
          </div>
        </div>
        
        <div className="description-info">
          <h3 className="description">
            About-Me
            {!isEditingDescription && (
              <button 
                className="edit-button" 
                onClick={handleEditDescription}
                style={{ marginLeft: '10px', fontSize: '0.8rem' }}
              >
                Edit
              </button>
            )}
          </h3>
          {isEditingDescription ? (
            <div className="description-edit">
              <textarea
                value={descriptionInput}
                onChange={(e) => setDescriptionInput(e.target.value)}
                className="description-textarea"
                rows={4}
                placeholder="Enter your description..."
              />
              <div className="description-actions">
                <button 
                  className="save-button"
                  onClick={handleSaveDescription}
                >
                  Save
                </button>
                <button 
                  className="cancel-button"
                  onClick={() => {
                    setIsEditingDescription(false);
                    setDescriptionInput(userData?.biography || "");
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <p className="description-details">{userData?.biography || "No description available"}</p>
          )}
        </div>
        <div className="role-selector">
          <h3>Role</h3>
          <select 
            className="role-select"
            value={userRole}
            onChange={handleRoleChange}
          >
            <option value="Student">Student</option>
            <option value="INSTRUCTOR">Instructor</option>
            <option value="GTA">Graduate Teaching Assistant</option>
            <option value="UTA">Undergraduate Teaching Assistant</option>
          </select>
        </div>
        {searchEnabled && (
          <button 
            className="view-students-button"
            onClick={() => navigate('/view-students')}
          >
            View Students
          </button>
        )}
      </div>
      
      <div className="profile-content">
        <div className="profile-actions">
          <button className="edit-profile-button" onClick={handleEditProfile}>
            Edit Profile
          </button>
          <button className="delete-profile-button" onClick={handleDeleteProfile}>
            Delete Profile
          </button>
        </div>

        <div className="availability-panel">
          <h3 className="panel-header">Set Your Availability</h3>
          <div className="time-input">
            <label>
              Start Time:
              <input 
                type="time" 
                name="startTime"
                value={availability.startTime}
                onChange={handleAvailabilityChange}
                list="valid-times" 
                step={3600}
              />
            </label>
            <label>
              End Time:
              <input 
                type="time" 
                name="endTime"
                value={availability.endTime}
                onChange={handleAvailabilityChange}
                list="valid-times" 
                step={3600}
              />
            </label>
            <select 
              name="day"
              value={availability.day}
              onChange={handleAvailabilityChange}
            >
              <option value="">Select Day</option>
              <option value="monday">Monday</option>
              <option value="tuesday">Tuesday</option>
              <option value="wednesday">Wednesday</option>
              <option value="thursday">Thursday</option>
              <option value="friday">Friday</option>
              <option value="saturday">Saturday</option>
              <option value="sunday">Sunday</option>
            </select>
            <button className="add-time" onClick={saveAvailability} disabled={availabilityLoading}>
              {availabilityLoading ? "Saving..." : "Add Availability"}
            </button>
            <button 
              className="remove-time" 
              onClick={() => {
                const { day, startTime, endTime } = availability;
                
                if (!day || !startTime || !endTime) {
                  toast.warning("Please select a day, start time, and end time");
                  return;
                }
              
                // Convert day to starting index (24 hours per day)
                const dayIndices = {
                  "monday": 0,
                  "tuesday": 24,
                  "wednesday": 48,
                  "thursday": 72,
                  "friday": 96,
                  "saturday": 120,
                  "sunday": 144
                };
                
                const dayIndex = dayIndices[day];
                
                // Convert time strings to hours
                const startHour = parseInt(startTime.split(":")[0]);
                const endHour = parseInt(endTime.split(":")[0]);
                
                if (startHour >= endHour) {
                  toast.warning("End time must be after start time");
                  return;
                }
              
                // Create a new availability string
                let newAvailabilityString = availabilityString.split('');
                
                // Mark the hours as unavailable (0)
                for (let hour = startHour; hour < endHour; hour++) {
                  newAvailabilityString[dayIndex + hour] = '0';
                }
                
                const updatedAvailabilityString = newAvailabilityString.join('');
              
                if (!userData) return;
              
                try {
                  if (!sessionId) {
                    toast.error("You must be logged in to update availability");
                    return;
                  }
              
                  axios.put(
                    `${base_url}/users/${userData.userEmail}`,
                    { weeklyAvailability: updatedAvailabilityString },
                    {
                      headers: {
                        'Content-Type': 'application/json',
                        'Session-Id': sessionId
                      }
                    }
                  ).then(response => {
                    if (response.status === 200) {
                      setAvailabilityString(updatedAvailabilityString);
                      
                      // Update the stored user data
                      const updatedUserData = { ...userData, weeklyAvailability: updatedAvailabilityString };
                      localStorage.setItem('userData', JSON.stringify(updatedUserData));
                      setUserData(updatedUserData);
                      
                      toast.success("Availability removed successfully!");
                    }
                  }).catch(error => {
                    console.error('Error removing availability:', error);
                    toast.error("Failed to remove availability. Please try again.");
                  });
                } catch (error) {
                  console.error('Error removing availability:', error);
                  toast.error("Failed to remove availability. Please try again.");
                }
              }}
            >
              Remove Availability
            </button>

            <div className="availability-preview">
              <h4>Current Availability:</h4>

              <div className="time-indicators-container">
                <div className="time-indicators-spacer"></div>
                <div className="time-indicators">
                  {timeIndicators}
                </div>
              </div>
              <div className="availability-visual">
                {formattedAvailability.map((day, index) => (
                  <DayRow
                    key={day.name}
                    day={day}
                    index={index}
                    toggleHourAvailability={toggleHourAvailability}
                    updatingHours={updatingHours}
                  />
                ))}
              </div>
              {updateError && (
                <div className="error-banner">
                  <p className="error-message">{updateError}</p>
                  <button 
                    className="dismiss-error"
                    onClick={() => setUpdateError(null)}
                    aria-label="Dismiss error"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="locations-container">
          <h3 className="panel-header">Preferred Study Locations</h3>
          <div className="locations-list">
            {userData?.preferredLocations?.length > 0 ? (
              userData.preferredLocations.map((locationId, index) => {
                // Create a mapping of location IDs to short names
                const locationNames = {
                  1: "WALC",
                  2: "LWSN",
                  3: "PMUC",
                  4: "HAMP",
                  5: "RAWL",
                  6: "CHAS",
                  7: "CL50",
                  8: "FRNY",
                  9: "KRAN",
                  10: "MSEE",
                  11: "MATH",
                  12: "PHYS",
                  13: "POTR",
                  14: "HAAS",
                  15: "HIKS",
                  16: "BRWN",
                  17: "HEAV",
                  18: "BRNG",
                  19: "SC",
                  20: "WTHR",
                  21: "UNIV",
                  22: "YONG",
                  23: "ME",
                  24: "ELLT",
                  25: "PMU",
                  26: "STEW"
                };

                // Handle both numeric IDs and legacy string location names
                const locationName = typeof locationId === 'number' 
                  ? locationNames[locationId]
                  : locationId; // For backwards compatibility
                
                return (
                  <div key={index} className="location">
                    <p className="location-name">{locationName}</p>
                    <button 
                      className="remove-location-button"
                      onClick={() => handleRemoveLocation(locationId, locationName)}
                      title={`Remove ${locationName}`}
                    >
                      ×
                    </button>
                  </div>
                );
              })
            ) : (
              <div className="location">
                <p className="location-name">No preferred locations</p>
              </div>
            )}
          </div>
          
          <select 
            className="location-select"
            onChange={(e) => {
              if (e.target.value && userData) {
                // Convert selected value to numeric ID
                const locationId = parseInt(e.target.value, 10);
                
                // Create array of preferred location IDs`
                const currentLocationIds = userData.preferredLocations?.map(loc => {
                  // If it's already a number, use it directly
                  if (typeof loc === 'number') return loc;
                  
                  // If locations were previously stored as strings, try to find their IDs
                  // This is for backward compatibility
                  const locationMap = {
                    "WALC": 1,
                    "LWSN": 2,
                    "PMUC": 3,
                    "HAMP": 4,
                    "RAWL": 5,
                    "CHAS": 6,
                    "CL50": 7,
                    "FRNY": 8,
                    "KRAN": 9,
                    "MSEE": 10,
                    "MATH": 11,
                    "PHYS": 12,
                    "POTR": 13,
                    "HAAS": 14,
                    "HIKS": 15,
                    "BRWN": 16,
                    "HEAV": 17,
                    "BRNG": 18,
                    "SC": 19,
                    "WTHR": 20,
                    "UNIV": 21,
                    "YONG": 22,
                    "ME": 23,
                    "ELLT": 24,
                    "PMU": 25,
                    "STEW": 26,
                    // Additional mappings for legacy data
                    "HICKS": 15,
                    "Student Union": 25,
                    "Engineering Building": 23
                  };
                  return locationMap[loc] || null;
                }).filter(id => id !== null) || [];
                
                // Add new location ID if not already in the list
                if (!currentLocationIds.includes(locationId)) {
                  currentLocationIds.push(locationId);
                }
                
                // Create updated user data with location IDs
                const updatedUserData = { 
                  ...userData, 
                  preferredLocations: currentLocationIds
                };
                
                localStorage.setItem('userData', JSON.stringify(updatedUserData));
                setUserData(updatedUserData);
                
                const sessionId = localStorage.getItem('sessionId');
                if (sessionId) {
                  axios.put(
                    `${base_url}/users/${userData.userEmail}`,
                    { preferredLocations: currentLocationIds },
                    {
                      headers: {
                        'Content-Type': 'application/json',
                        'Session-Id': sessionId
                      }
                    }
                  ).catch(error => {
                    console.error('Error saving locations:', error);
                  });
                }
              }
              e.target.value = "";
            }}
          >
            <option value="">Select a location</option>
            <option value="1">WALC</option>
            <option value="2">LWSN</option>
            <option value="3">PMUC</option>
            <option value="4">HAMP</option>
            <option value="5">RAWL</option>
            <option value="6">CHAS</option>
            <option value="7">CL50</option>
            <option value="8">FRNY</option>
            <option value="9">KRAN</option>
            <option value="10">MSEE</option>
            <option value="11">MATH</option>
            <option value="12">PHYS</option>
            <option value="13">POTR</option>
            <option value="14">HAAS</option>
            <option value="15">HIKS</option>
            <option value="16">BRWN</option>
            <option value="17">HEAV</option>
            <option value="18">BRNG</option>
            <option value="19">SC</option>
            <option value="20">WTHR</option>
            <option value="21">UNIV</option>
            <option value="22">YONG</option>
            <option value="23">ME</option>
            <option value="24">ELLT</option>
            <option value="25">PMU</option>
            <option value="26">STEW</option>
          </select>
        </div>

        <div className="courses-container">
          <h3 className="panel-header">My Courses</h3>
          
          {coursesLoading ? (
            <div className="loading-courses">
              <div className="skeleton-courses">
                <div className="skeleton-course"></div>
                <div className="skeleton-course"></div>
                <div className="skeleton-course"></div>
              </div>
            </div>
          ) : (
            coursesData && coursesData.length > 10 ? (
              <div style={{ height: 250 }}>
                <List
                  height={250}
                  itemCount={coursesData.length}
                  itemSize={50}
                  width="100%"
                >
                  {({ index, style }) => {
                    const course = coursesData[index];
                    return (
                      <div style={style} className="course-item">
                        <p className="course-name">
                          {course.courseId || course}
                          {course.courseName && course.courseId !== course.courseName && (
                            <span className="course-full-name"> - {course.courseName}</span>
                          )}
                        </p>
                      </div>
                    );
                  }}
                </List>
              </div>
            ) : (
              <div className="courses-list">
                {coursesData && coursesData.length > 0 ? (
                  coursesData.map((course, index) => (
                    <div key={index} className="course-item">
                      <p className="course-name">
                        {course.courseId || course}
                        {course.courseName && course.courseId !== course.courseName && (
                          <span className="course-full-name"> - {course.courseName}</span>
                        )}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="empty-courses-message">
                    <p>No courses added yet! Add courses on the course tab.</p>
                  </div>
                )}
              </div>
            )
          )}
        </div>
      </div>
      
      {isEditingProfile && (
        <div className="edit-profile-modal">
          <div className="edit-profile-form">
            <h3>Edit Profile Information</h3>
            <div className="form-group">
              <label htmlFor="name">Name</label>
              <input
                type="text"
                id="name"
                name="name"
                value={editedProfileData.name}
                onChange={handleProfileInputChange}
              />
            </div>
            <div className="form-group">
              <label htmlFor="userEmail">Email</label>
              <input
                type="email"
                id="userEmail"
                name="userEmail"
                value={editedProfileData.userEmail}
                onChange={handleProfileInputChange}
                className={emailError ? "input-error" : ""}
              />
              {emailError && <span className="error-message">{emailError}</span>}
            </div>
            <div className="form-group">
              <label htmlFor="majors">Majors (comma separated)</label>
              <input
                type="text"
                id="majors"
                name="majors"
                value={editedProfileData.majorsString || editedProfileData.majors.join(', ')}
                onChange={handleProfileInputChange}
                placeholder="e.g. CS, Math, Statistics"
              />
            </div>
            <div className="form-buttons">
              <button 
                className="save-profile-button"
                onClick={handleSaveProfile}
              >
                Save Changes
              </button>
              <button 
                className="cancel-profile-button"
                onClick={() => {
                  setIsEditingProfile(false);
                  setEditedProfileData({
                    name: userData?.name || "",
                    userEmail: userData?.userEmail || "",
                    majors: userData?.majors || [],
                    majorsString: (userData?.majors || []).join(', ')
                  });
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      
      {showDeleteModal && (
        <div className="modal-overlay">
          <div className="modal-content delete-modal">
            <h3>Delete Account</h3>
            <p>This action cannot be undone. Please enter your password to confirm.</p>
            
            <div className="password-field-container">
              <input 
                type={showPassword ? "text" : "password"} 
                placeholder="Password" 
                value={deletePassword}
                onChange={(e) => {
                  setDeletePassword(e.target.value);
                }}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    confirmDeleteProfile();
                  }
                }}
              />
              <button 
                type="button" 
                className="toggle-password-visibility" 
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            
            <div className="modal-buttons">
              <button 
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeletePassword('');
                  toast.info("Delete profile cancelled.");
                }}
                className="cancel-button"
              >
                Cancel
              </button>
              <button 
                onClick={confirmDeleteProfile}
                className="delete-button"
                disabled={!deletePassword}
              >
                Delete Account
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Hidden datalist for time selection */}
      <datalist id="valid-times">
        <option value="00:00"></option>
        <option value="01:00"></option>
        <option value="02:00"></option>
        <option value="03:00"></option>
        <option value="04:00"></option>
        <option value="05:00"></option>
        <option value="06:00"></option>
        <option value="07:00"></option>
        <option value="08:00"></option>
        <option value="09:00"></option>
        <option value="10:00"></option>
        <option value="11:00"></option>
        <option value="12:00"></option>
        <option value="13:00"></option>
        <option value="14:00"></option>
        <option value="15:00"></option>
        <option value="16:00"></option>
        <option value="17:00"></option>
        <option value="18:00"></option>
        <option value="19:00"></option>
        <option value="20:00"></option>
        <option value="21:00"></option>
        <option value="22:00"></option>
        <option value="23:00"></option>
      </datalist>

      <ToastContainer 
        position="bottom-left"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />
    </div>
  );
}

export default Profile;