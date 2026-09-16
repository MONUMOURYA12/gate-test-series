import { useState } from "react";
import { questionMediaUrl } from "../services/api";
import "./question-media.css";

export default function QuestionMedia({ images = [] }) {
  const [failed, setFailed] = useState(false);
  if (!images.length) return null;
  const safeImages = images.map(image => ({ ...image, url: questionMediaUrl(image.url) })).filter(image => image.url);
  return <div className="question-media">
    {(failed || safeImages.length !== images.length) && <p role="alert">The question image could not load. Refresh before answering.</p>}
    {safeImages.map((image, index) => <a key={image.url} href={image.url} target="_blank" rel="noopener noreferrer" title="Open question image at full size">
      <img src={image.url} width={image.width} height={image.height}
        alt={`Original question and diagrams, part ${index + 1}`} onError={() => setFailed(true)} />
    </a>)}
  </div>;
}
