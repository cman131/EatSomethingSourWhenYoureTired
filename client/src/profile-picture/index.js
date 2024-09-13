import React, { useState } from "react";
import stringToGradient from "./stringToGradient";
import styles from "./styles.module.css";

const ProfilePic = (props = { className: "", image: "", imageUpdated: () => {} }) => {
    const [isChanging, setIsChanging] = useState(false);
    async function changeImage() {
        const element = document.querySelector('#upload-image-input');
        const reader = new FileReader();
        reader.readAsDataURL(element.files[0]);
        reader.onload = () => {
            props.imageUpdated(reader.result);
            setIsChanging(false);
        };
        reader.onerror = () => setIsChanging(false);
    }

    return (
        <div className={`${styles.avatarContainer}`}>
            <div
            className={`${styles.avatar} ${props.className ? props.className : ""}`}
            style={{
                backgroundImage: `url(${props.image}), ${stringToGradient(props.name)}`
            }}
            >
            {!props.image && (
                <svg className={styles.letterPlaceholder} viewBox="0 0 60 60">
                <text x="50%" y="52%" textAnchor="middle" alignmentBaseline="middle">
                    {Array.from(props.name)[0].toUpperCase()}
                </text>
                </svg>
            )}
            </div>
            <button className={`btn btn-secondary ${isChanging ? 'hidden' : '' }`} onClick={() => setIsChanging(true)}>Change avatar</button>
            <input id="upload-image-input" className={`btn btn-secondary ${!isChanging ? 'hidden' : '' }`} type="file" onChange={changeImage} />
            <button className={`btn btn-link ${!isChanging ? 'hidden' : '' }`} onClick={() => setIsChanging(false)}>Cancel</button>
        </div>
    );
};

export default ProfilePic;